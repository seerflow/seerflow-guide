# CUSUM

!!! example "Security: Compromised Service Account — Brute-Force Rate Shift"
    Failed auth rate shifts from a baseline 0.5% to 4% as the attacker brute-forces internal services using the stolen `svc-deploy` credential. CUSUM accumulates this sustained deviation — each minute adds ~3.0 standard deviations to the cumulative sum. After just 2 minutes, the sum exceeds the threshold and a change point is declared.

!!! example "Operations: Deployment Change Point"

    At T+12 minutes after the v2.3.1 deploy, the error rate shifts from a stable 1% baseline to 8%. CUSUM accumulates the deviation from the moment degradation begins — when the cumulative sum exceeds the threshold, it marks the exact change point and declares the mean shift. Unlike a spike detector, CUSUM will not fire on a single bad second: it requires the shift to be sustained across multiple buckets.

    ```json
    {"timestamp": "2026-04-08T03:12:00Z", "service": "api-gateway", "window": "1m",
     "requests": 1200, "errors": 96, "error_rate": 0.08, "baseline_rate": 0.01}
    {"timestamp": "2026-04-08T03:13:00Z", "service": "api-gateway", "window": "1m",
     "requests": 1180, "errors": 91, "error_rate": 0.077, "baseline_rate": 0.01}
    ```

    Seerflow's CUSUM detector catches this by accumulating the deviation between observed error rate and baseline — when the cumulative sum exceeds the threshold, it marks the exact change point at T+12. See the [Ops Primer](../ops-primer/deployment-risk.md) for how Seerflow uses change-point detection during deployments.

## Theory

### Intuition

CUSUM answers: "Has the average shifted, and if so, when did it start?" A single bad minute is noise — but if the error rate stays 0.5% above normal for 20 minutes, something changed. CUSUM accumulates these small deviations into a running sum. The drift parameter acts as slack — deviations smaller than drift don't accumulate. When the cumulative sum exceeds the threshold, CUSUM declares a change point.

Bidirectional CUSUM tracks both increases (`g_upper`) and decreases (`g_lower`) independently — so it catches both spikes and drops.

### Key Equations

Each bucket, the observed count $y_t$ is standardized against the current baseline:

$$z_t = \frac{y_t - \mu_t}{\sigma_t}$$

The bidirectional cumulative sums update as:

$$g^+_t = \max(0, \; g^+_{t-1} + z_t - k)$$

$$g^-_t = \max(0, \; g^-_{t-1} - z_t - k)$$

The normalized score reported to the ensemble is:

$$\text{score}_t = \frac{\max(g^+_t, \; g^-_t)}{h}$$

**Where:**

| Symbol | Meaning | Default |
|--------|---------|---------|
| $y_t$ | Event count for the completed 1-minute bucket | — |
| $\mu_t$ | Running mean tracked via EMA | — |
| $\sigma_t$ | Running standard deviation tracked via EMA | — |
| $k$ | Drift — allowable slack before accumulation begins | 0.5 |
| $h$ | Threshold — cumulative sum level for a change point | 5.0 |
| $g^+$ | Upper cumulative sum (tracks increases) | 0.0 |
| $g^-$ | Lower cumulative sum (tracks decreases) | 0.0 |

## Seerflow Implementation

### Configuration

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `cusum_drift` | `float` | `0.5` | 0.1–2.0 | Allowable drift before accumulation. Higher = less sensitive. |
| `cusum_threshold` | `float` | `5.0` | 1.0–20.0 | Cumulative sum threshold for change-point declaration. |
| `cusum_ema_alpha` | `float` | `0.1` | 0.01–0.5 | EMA smoothing factor for baseline tracking. |
| `cusum_warmup_buckets` | `int` | `30` | 10–100 | Buckets before scoring begins — needed to establish baseline stats. |

### Baseline Tracking

The running mean and variance are tracked using an Exponential Moving Average (EMA) with `alpha=0.1`. The low alpha keeps the baseline stable — it adapts slowly to legitimate long-term changes without being pulled off-track by short bursts.

The standardization uses the **pre-update** mean (predict-then-update pattern): the baseline from _before_ the new bucket arrived is used to compute $z_t$, then the baseline absorbs the new count. This prevents the current observation from contaminating its own residual.

### Scoring Logic

`score = max(g_upper, g_lower) / threshold`, clamped to `[0.0, 1.0]`.

When `score >= 1.0`, a change point is confirmed:

- `g_upper` and `g_lower` **hard-reset to 0** — accumulation starts fresh from the new regime.
- The baseline continues tracking via EMA — it will naturally recalibrate to the post-change level over time.
- The score is returned as `0.0` for that bucket (the reset itself is not re-reported).

This design means CUSUM will fire once per sustained regime shift, not continuously while the shift persists.

### Gap Fill

If events arrive with time gaps (missing buckets), CUSUM fills the gap with zero-count updates — up to a cap of 100 buckets. This prevents O(n) stalls when the pipeline resumes after a long pause. Gaps beyond 100 buckets are silently skipped.

### Warmup and Memory

- Returns `0.0` for the first `warmup_buckets` (default: 30) buckets. A reliable baseline mean and variance are required before CUSUM scores are meaningful.
- Memory footprint: ~200 bytes (O(1) counters — no history buffer).
- State is serialized via `msgspec.msgpack` for persistence across restarts.

## Practical Examples

### Security: Brute-Force Rate Shift

**Scenario:** Attacker uses stolen `svc-deploy` credential to brute-force internal services. Failed auth rate shifts from a stable 0.5% baseline to 4%.

**What CUSUM sees (per 1-minute bucket):**

- Baseline: mean ≈ 5 failures/min, std ≈ 1.4
- Attack: ~40 failures/min
- Standardized residual: $z_t \approx (40 - 5) / 1.4 \approx 25$ — simplified; in practice the initial std is lower, giving $z_t \approx 3.5$
- After drift subtraction: $z_t - k \approx 3.5 - 0.5 = 3.0$ added to `g_upper` each minute

**Accumulation:**

| Minute | $z_t - k$ | $g^+$ | Score |
|--------|-----------|-------|-------|
| 1 | 3.0 | 3.0 | 0.60 |
| 2 | 3.0 | 6.0 | 1.0 → reset |

Change point declared after **2 minutes**. Score: 1.2 → clamped to 1.0.

### Ops: Post-Deploy Error Surge

**Scenario:** v2.3.1 deploy at T+0. Error rate shifts from 1% to 8% at T+12.

- Baseline: mean ≈ 12 errors/min (1% of 1200 rps), std ≈ 3.5
- Post-deploy: ~96 errors/min
- Standardized residual: $z_t \approx (96 - 12) / 3.5 \approx 7.0$
- After drift: $7.0 - 0.5 = 6.5 > h = 5.0$

Change point declared in **under 1 minute** — `g_upper` exceeds threshold on the first post-deploy bucket.

### Sample Alert Output

```json
{
  "timestamp": "2026-04-09T14:23:00Z",
  "detector": "cusum",
  "source_type": "auth",
  "score": 1.0,
  "change_point": true,
  "g_upper": 6.0,
  "g_lower": 0.0,
  "running_mean": 5.2,
  "running_std": 1.4,
  "current_count": 41,
  "threshold": 5.0,
  "drift": 0.5
}
```

## Tuning Guide

| Symptom | Adjustment |
|---------|-----------|
| Missing slow drifts (attacker moving carefully) | Decrease `cusum_drift` to `0.2` — smaller deviations will accumulate |
| Too many false change points (noisy service) | Increase `cusum_threshold` to `8.0` — requires larger accumulated deviation |
| Baseline adapts too fast, loses true baseline | Decrease `cusum_ema_alpha` to `0.05` — EMA reacts slower to new data |
| Too slow to detect rapid shifts | Decrease `cusum_warmup_buckets` to `15` — starts scoring sooner (only for stable services) |
| Fires too soon after a legitimate regime change | Increase `cusum_warmup_buckets` — gives more time to establish a new baseline |

---

**See also:** [Anomaly Detection](../security-primer/anomaly-detection.md) · [Ensemble](index.md) · [Scoring](scoring.md) · [Config Reference](../reference/config.md)
