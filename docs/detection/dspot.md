# DSPOT Adaptive Thresholds

!!! example "Security: Compromised Service Account — Exceeding Adaptive Threshold"
    The compromised `svc-deploy` attack produces elevated blended scores from HST + Markov convergence. The 3 AM time window normally has lower scores (less activity = fewer anomalies). DSPOT's adaptive threshold accounts for this — but the attack's blended score of 4.8 exceeds even the seasonally adjusted z_q bound of 3.2.

!!! example "Operations: Latency Tail Auto-Threshold"

    After the v2.3.1 deploy, p99 latency climbs from 200ms to 2s as connection pool exhaustion forces requests to queue. DSPOT's threshold had been adapting upward to accommodate gradual latency growth during the release window — by 03:15 the upper z_q had drifted to 892ms. But the post-deploy spike to 1,847ms and then 2,103ms lies well beyond even that adapted extreme bound.

    ```json
    {"timestamp": "2026-04-08T03:18:00Z", "service": "api-gateway", "metric": "p99_latency_ms",
     "value": 1847, "dspot_threshold": 892, "exceeded": true, "anomaly_direction": "upper"}
    {"timestamp": "2026-04-08T03:19:00Z", "service": "api-gateway", "metric": "p99_latency_ms",
     "value": 2103, "dspot_threshold": 921, "exceeded": true, "anomaly_direction": "upper"}
    ```

    Seerflow's DSPOT detector catches this by fitting a Generalized Pareto Distribution to the score tail — the threshold auto-adjusts for seasonal variation and gradual drift, but the post-deploy values land well beyond the expected extreme. See the [Ops Primer](../ops-primer/deployment-risk.md) for how deployment risk windows interact with adaptive thresholds.

## Theory

### Intuition

Instead of a fixed threshold, DSPOT asks: "Given what I've seen, how extreme is this score?" It uses Extreme Value Theory (EVT) — specifically the Generalized Pareto Distribution (GPD) — to model the tail of the score distribution. The threshold auto-adjusts as the environment changes, but truly extreme values still trigger. The approach is bidirectional: an upper threshold catches spikes and novel errors, while a lower threshold catches unusual silence or drops in activity — both are statistically grounded in the same EVT framework.

The Peaks-Over-Threshold (POT) method works like this: scores above a high initial percentile (the 98th by default) are treated as tail excesses. DSPOT collects these excesses, fits a GPD to them, and derives z_q — the score value where the probability of exceeding it is at most `risk_level` (default 0.0001, i.e. 1 in 10,000). As new excesses accumulate, the GPD is periodically refitted and z_q is updated. If the score distribution shifts — because a deployment changes normal behavior — the excess pool changes, the GPD shifts, and z_q follows. Genuine anomalies remain extreme relative to the updated tail.

### Key Equations

**GPD cumulative distribution function** — the probability that a tail excess \(x\) is no greater than some value, given shape \(\xi\) and scale \(\sigma\):

\[
F(x) = 1 - \left(1 + \xi \cdot \frac{x}{\sigma}\right)^{-1/\xi}
\]

**Anomaly quantile** — the threshold z_q above which an observation has probability at most \(q\) of occurring:

\[
z_q = t + \frac{\sigma}{\xi} \left[\left(\frac{n}{N_t \cdot q}\right)^\xi - 1\right]
\]

Where:

- \( x \) = excess above initial threshold \( t \) (i.e. the amount by which a score exceeds the 98th percentile)
- \( \xi \) = GPD shape parameter (tail heaviness — larger positive values mean heavier tails)
- \( \sigma \) = GPD scale parameter (fitted via maximum likelihood)
- \( t \) = initial threshold, set at the `initial_percentile`-th percentile of the calibration window
- \( n \) = total observations since calibration
- \( N_t \) = number of observations that exceeded \( t \) (exceedances used to fit the GPD)
- \( q \) = risk level (default 0.0001 — target false positive rate per observation)

When \( |\xi| < 10^{-10} \) (nearly exponential tail), the formula simplifies to:

\[
z_q = t + \sigma \cdot \ln\!\left(\frac{N_t}{n \cdot q}\right)
\]

The lower threshold mirrors this: excesses are computed as deficits below the 2nd percentile, the same GPD formula gives a lower z_q, and it is reflected back into score space.

## Seerflow Implementation

### Configuration

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `dspot.calibration_window` | `int` | `1000` | 200–5000 | Number of scores collected before GPD fitting begins. Larger values produce more stable initial thresholds at the cost of a longer warmup period. |
| `dspot.risk_level` | `float` | `0.0001` | 0.00001–0.01 | Target false positive rate per observation. Lower values produce a higher (more conservative) z_q threshold. |
| `dspot.initial_percentile` | `int` | `98` | 90–99 | Percentile used to set the initial tail threshold after calibration. Upper tail at the P-th percentile, lower tail at the (100 − P)-th percentile. |

### Calibration Phase

During the first `calibration_window` scores (default 1000), DSPOT collects all scores and flags nothing as anomalous — the `ThresholdResult` always returns `is_anomaly=False`. After the calibration window is full:

1. Upper initial threshold is set to the 98th percentile of collected scores.
2. Lower initial threshold is set to the 2nd percentile.
3. Scores above the upper threshold are collected as excesses; scores below the lower threshold are collected as deficits (mirrored to positive values).
4. GPD is fitted independently to upper excesses and lower deficits via `scipy.stats.genpareto`.
5. z_q is computed for each tail using the quantile formula above.
6. Fallback: if the GPD fit produces a non-finite z_q (too few excesses or a degenerate fit), the initial percentile value is used as the threshold until more data arrives.

### Bidirectional Detection

Every call to `DSpotThreshold.update(score)` returns a `ThresholdResult`:

| Field | Type | Description |
|-------|------|-------------|
| `is_anomaly` | `bool` | `True` if the score exceeds either threshold |
| `upper_threshold` | `float` | Current upper z_q |
| `lower_threshold` | `float` | Current lower z_q |
| `score` | `float` | The input score |
| `anomaly_direction` | `"upper" \| "lower" \| None` | Direction of the anomaly, or `None` if not anomalous |

- **Upper anomaly:** `score > upper_z_q` — spike, novel error, elevated activity.
- **Lower anomaly:** `score < lower_z_q` — unusual silence, service dropout, metric drop.

### Re-calibration

After calibration, DSPOT continues to accumulate tail excesses and refits the GPD as new data arrives:

- Every new score above the upper initial threshold adds an excess to the upper pool and increments `n_exceed`.
- Every new score below the lower initial threshold adds a deficit to the lower pool.
- GPD is refitted every 50 new exceedances for each tail independently.
- Excess lists are capped at 10,000 entries (oldest are dropped) to bound memory growth.
- `n_total` (total observations since calibration) is used in the z_q formula to keep the false positive rate calibrated as the stream grows.

### Warmup and Memory

- No anomalies are flagged during the calibration window — the 1000-score warmup is a hard gate.
- Memory footprint after calibration: approximately 8 KB (two excess lists of up to 10,000 floats each, plus scalar state).
- Serialization uses `msgspec` JSON encoding of a typed `_BiDSpotState` struct. Serialization is only safe after calibration (`is_calibrated == True`) — pre-calibration scores are not persisted.

## Practical Examples

### Security: Blended Score Exceeds Adaptive Threshold

After 1000 calibration scores from the 3 AM quiet window, DSPOT fits the tail and arrives at:

- Upper initial threshold \( t \) = 2.6 (98th percentile of nighttime blended scores)
- GPD fit: \( \xi = 0.15 \), \( \sigma = 0.41 \)
- Upper z_q = **3.2** at risk_level = 0.0001

The attacker's lateral movement produces a blended score of **4.8** (HST: 0.91, Markov: 0.83, combined by signal amplification). Since 4.8 > 3.2:

```json
{
  "is_anomaly": true,
  "upper_threshold": 3.2,
  "lower_threshold": 0.4,
  "score": 4.8,
  "anomaly_direction": "upper"
}
```

### Ops: Post-Deploy Cascade

After the v2.3.1 deploy, latency scores were gradually drifting — normal connection pool warm-up behavior. DSPOT's z_q adapted upward through refit cycles. By 03:15 the calibrated z_q had reached **2.8**. The post-deploy cascade pushed the blended score to **5.1**:

```json
{
  "is_anomaly": true,
  "upper_threshold": 2.8,
  "lower_threshold": 0.3,
  "score": 5.1,
  "anomaly_direction": "upper"
}
```

### Lower Threshold: Detecting Silence

If a normally busy service suddenly goes quiet — log volume drops, blended scores fall — the lower threshold catches it. A service that ordinarily produces blended scores around 1.2 going completely silent (score = 0.05) would trigger:

```json
{
  "is_anomaly": true,
  "upper_threshold": 3.1,
  "lower_threshold": 0.18,
  "score": 0.05,
  "anomaly_direction": "lower"
}
```

This is useful for detecting service outages, log pipeline breaks, or an attacker who has silenced logging on a compromised host.

## Tuning Guide

| Symptom | Adjustment | Effect |
|---------|-----------|--------|
| Too many false positives | Decrease `dspot.risk_level` to `0.00001` | Raises z_q — only the most extreme scores fire |
| Missing real anomalies | Increase `dspot.risk_level` to `0.001` | Lowers z_q — more sensitive, more alerts |
| Thresholds too volatile | Increase `dspot.calibration_window` to `2000` | More data before initial GPD fit = more stable thresholds |
| Want to catch drops | Monitor `anomaly_direction == "lower"` | Lower z_q fires on silence, metric drops, service outages |
| Threshold drifting too fast | Review excess accumulation rate | If many scores exceed the initial percentile, consider raising `dspot.initial_percentile` to 99 |

**Risk level as false positive budget:** at `risk_level = 0.0001`, you expect at most 1 anomaly flag per 10,000 normal scores. At `risk_level = 0.00001`, the budget is 1 per 100,000. Choose based on your alert fatigue tolerance and downstream dedup strategy.

**Calibration window sizing:** the calibration window must capture a representative sample of the score distribution. For seasonal workloads (e.g. daytime vs. nighttime traffic), consider running separate `DSpotThreshold` instances per time window, or using a large calibration window (2000–5000) to span multiple cycles before fitting begins.

## Cross-Links

- [Half-Space Trees](hst.md) — produces the per-event anomaly scores that DSPOT thresholds
- [Holt-Winters](holt-winters.md) — volume-level anomaly detection that also feeds the blended score
- [CUSUM](cusum.md) — change-point detection complementing DSPOT's tail approach
- [Markov Chains](markov.md) — sequence anomaly scores entering the blended signal
- [Scoring & Attack Mapping](scoring.md) — how DSPOT's `ThresholdResult` combines with other detectors
- [Ensemble Overview](index.md) — how all detectors and DSPOT connect end-to-end
- [Anomaly Detection concepts](../security-primer/anomaly-detection.md) — background on EVT and streaming thresholds
- [Configuration Reference](../reference/config.md) — `dspot.calibration_window`, `dspot.risk_level`, `dspot.initial_percentile`
- [Deployment Risk](../ops-primer/deployment-risk.md) — ops context for threshold adaptation during deploys

**Next:** [Scoring & Attack Mapping →](scoring.md) — how detector scores are blended and mapped to MITRE ATT&CK.
