# Holt-Winters

!!! example "Security: Compromised Service Account — 3 AM Volume Spike"
    Host `dev-host-1` normally sees ~2 auth events/min at 3 AM. When the attacker starts lateral movement using the stolen `svc-deploy` credential, auth volume spikes to 45/min. The seasonal model predicts 2 — the deviation is massive relative to the prediction band, producing a score of 1.0 (maximum anomaly).

!!! example "Operations: Connection Pool Trend Divergence"

    The `postgres-primary` database shows active connections climbing steadily after the v2.3.1 deploy, diverging from the expected daily seasonal pattern where connections drop during low-traffic hours.

    ```
    2026-04-08 03:18:22.451 UTC [pid=1842] LOG:  connection stats: active=45/50 idle=3 waiting=12
    2026-04-08 03:18:52.451 UTC [pid=1842] LOG:  connection stats: active=48/50 idle=1 waiting=28
    2026-04-08 03:19:22.451 UTC [pid=1842] WARNING:  remaining connection slots are reserved: active=50/50 waiting=41
    ```

    The trend component catches the steady post-deploy climb while the seasonal component says "this should be dropping at 3 AM — traffic is always low here." Both signals point in the same direction: predicted 15 connections, observed 48, residual 33. That residual is far outside the normal band, producing a score of 1.0. See the [Ops Primer](../ops-primer/deployment-risk.md) for more on deployment risk windows.

## Theory

### Intuition

If your server normally gets 1000 requests/min at noon but only 200 at 3 AM, a static threshold fails — 800 at noon is normal, 800 at 3 AM is an emergency. Holt-Winters decomposes the time series into three components: the overall level (how many events are typical), the trend (is volume growing or shrinking?), and the seasonal pattern (the 24-hour cycle). By predicting what's expected at each point, it can flag deviations that respect the time of day.

The "triple" in triple exponential smoothing means three smoothing equations — one per component. Each has its own smoothing factor (alpha, beta, gamma) that controls how quickly it reacts to new data. The residual — the difference between actual and predicted — drives the anomaly score.

### Key Equations

The four update equations run once per completed 1-minute bucket:

\[
L_t = \alpha \cdot (y_t - S_{t-p}) + (1 - \alpha) \cdot (L_{t-1} + T_{t-1})
\]

\[
T_t = \beta \cdot (L_t - L_{t-1}) + (1 - \beta) \cdot T_{t-1}
\]

\[
S_t = \gamma \cdot (y_t - L_t) + (1 - \gamma) \cdot S_{t-p}
\]

\[
\hat{y}_t = L_{t-1} + T_{t-1} + S_{t-p}
\]

Where:

- \( y_t \) = observed event count in bucket t
- \( L_t \) = level (smoothed average)
- \( T_t \) = trend (smoothed slope)
- \( S_t \) = seasonal component (cyclic offset)
- \( p \) = seasonal period (1440 buckets = 24 hours)
- \( \alpha, \beta, \gamma \) = smoothing factors

The prediction band and anomaly score are:

\[
\text{band} = n_{\text{std}} \cdot \sigma_{\text{residuals}}
\]

\[
\text{score} = \frac{|y_t - \hat{y}_t|}{n_{\text{std}} \cdot \sigma_{\text{residuals}}}, \quad \text{clamped to } [0, 1]
\]

The standard deviation \( \sigma_{\text{residuals}} \) is computed over the last 100 completed buckets. Clamping ensures the score never exceeds 1.0 even when the deviation is extreme.

## Seerflow Implementation

### Configuration

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `hw_seasonal_period` | `int` | `1440` | 60–10080 | Seasonal period in 1-min buckets. 1440=24h, 10080=7d. |
| `hw_alpha` | `float` | `0.3` | 0.0–1.0 | Level smoothing. Higher = reacts faster to level shifts. |
| `hw_beta` | `float` | `0.1` | 0.0–1.0 | Trend smoothing. Higher = reacts faster to trend changes. |
| `hw_gamma` | `float` | `0.1` | 0.0–1.0 | Seasonal smoothing. Higher = adapts seasonal pattern faster. |
| `hw_n_std` | `float` | `3.0` | 1.0–5.0 | Prediction band width in standard deviations. |

### Input & Bucketing

Events are counted in 1-minute buckets. Each bucket spans exactly 60 billion nanoseconds (`_BUCKET_NS = 60 * 1_000_000_000`). The detector computes the bucket index from the event's `timestamp_ns` field — `bucket = timestamp_ns // _BUCKET_NS`.

When a new event arrives in the same bucket as the previous event, only the count is incremented. No smoothing runs. When the first event arrives in a new bucket, the completed bucket's count is flushed into the Holt-Winters update equations, then the new bucket begins with a count of 1.

If buckets are skipped (a gap in log traffic), the detector fills each missing bucket with a count of 0 and runs the update equations for each, up to `seasonal_period` gap buckets. This prevents a long silence from corrupting the seasonal indices.

### Scoring Logic

The score is computed once per completed bucket using the residual from that bucket:

\[
\text{score} = \min\!\left(\frac{|\text{residual}|}{n_{\text{std}} \cdot \text{stdev}(\text{last 100 residuals})}, \; 1.0\right)
\]

All events that arrive within the same bucket return the score from the most recently completed bucket (`_last_score`). This means the score is stable within a minute and updates at bucket boundaries. If fewer than 2 residuals have been collected, the score is 0.0 — there is not yet enough variance history to define a band.

### Warmup & Memory

The detector returns `0.0` during warmup. Warmup lasts for the first `seasonal_period` buckets — 24 hours at the default setting. This is required because the seasonal component `S_t` needs one full cycle of observations before it can make a meaningful prediction. During warmup, the detector accumulates a running average for the level and records seasonal offsets, but does not score.

Memory footprint is approximately 12 KB at default settings:

- 1440 seasonal floats × 8 bytes = ~11.5 KB
- Residual deque: 100 floats × 8 bytes = 800 bytes
- State scalars (level, trend, t, current bucket/count, last score): ~100 bytes

State is serialized to msgpack bytes via `msgspec` using the `_HWState` struct, and can be restored with `deserialize()` — enabling persistence across restarts without losing the learned seasonal pattern.

## Practical Examples

### Security Walkthrough: 3 AM Auth Spike

`dev-host-1` auth events, 03:17 UTC:

| Field | Value |
|-------|-------|
| Seasonal prediction \( \hat{y}_t \) | 2 events/min |
| Observed \( y_t \) | 45 events/min |
| Residual | 43 |
| Band \( n_{\text{std}} \cdot \sigma \) | ±6 (based on 100-bucket history) |
| Score | `min(43 / 6, 1.0)` = **1.0** |

The score hits the ceiling immediately. Even at `hw_n_std = 5.0`, a residual of 43 against a band of ±10 still produces 1.0. The lateral movement is unambiguous.

### Ops Walkthrough: Connection Pool After Deploy

`postgres-primary` active connections, 03:18 UTC:

| Field | Value |
|-------|-------|
| Seasonal prediction \( \hat{y}_t \) | 15 connections |
| Observed \( y_t \) | 48 connections |
| Residual | 33 |
| Band \( n_{\text{std}} \cdot \sigma \) | ±9 (based on 100-bucket history) |
| Score | `min(33 / 9, 1.0)` = **1.0** |

The trend component had already started tracking the upward slope from the deploy. The seasonal component amplifies the signal at 3 AM by expecting a drop. Both agree: something is wrong.

### What the Operator Sees

The ensemble packages the Holt-Winters score alongside the other detector scores in the alert JSON:

```json
{
  "alert_id": "a1b2c3d4-...",
  "entity": "dev-host-1",
  "source_type": "auth",
  "timestamp": "2026-04-08T03:17:00Z",
  "scores": {
    "holt_winters": 1.0,
    "half_space_trees": 0.62,
    "cusum": 0.88
  },
  "blended_score": 0.94,
  "hw_detail": {
    "predicted": 2.0,
    "observed": 45,
    "residual": 43.0,
    "band": 6.1,
    "seasonal_period": 1440,
    "warmup_complete": true
  },
  "message": "Auth volume 22x above seasonal prediction at 03:17 UTC"
}
```

## Tuning Guide

**Too many false positives at peak hours**
: Increase `hw_n_std` from 3.0 to 4.0 or 5.0. This widens the prediction band, requiring a larger deviation before the score exceeds 0.5. Useful when traffic spikes are legitimately variable at peak.

**Missing slow-growing trends (gradual resource exhaustion)**
: Decrease `hw_beta` from 0.1 toward 0.05. A lower beta makes the trend component lag behind, so a gradual upward drift accumulates more residual before the trend catches up — making it more detectable.

**Seasonal pattern has permanently shifted (new traffic schedule, timezone change)**
: Temporarily increase `hw_gamma` to 0.3–0.5 to let the seasonal indices adapt faster, then lower it back to 0.1 once the new pattern has stabilized. Watch for increased false positives during the transition.

**High-frequency sources with sub-hourly seasonality (e.g., batch jobs every 15 minutes)**
: Decrease `hw_seasonal_period` to match the cycle. For a 15-minute cycle: `hw_seasonal_period = 15`. Warmup will complete in 15 minutes instead of 24 hours, but the model will only learn within that shorter cycle.

**Source goes silent for extended periods (maintenance windows)**
: The gap-filling logic handles this automatically, but a very long silence followed by normal traffic may inflate the residual variance. Consider calling `deserialize()` with a fresh state after planned maintenance windows.

## See Also

- [Anomaly Detection](../security-primer/anomaly-detection.md) — how volume anomalies fit into the detection pipeline
- [Ensemble & Blending](index.md) — how Holt-Winters scores combine with HST, CUSUM, and Markov
- [Scoring & Attack Mapping](scoring.md) — blended score normalization and MITRE ATT&CK mapping
- [Configuration Reference](../reference/config.md) — full parameter list with environment variable names

**Next:** [CUSUM →](cusum.md) — change-point detection via bidirectional cumulative sums.
