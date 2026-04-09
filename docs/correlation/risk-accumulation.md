# Risk Accumulation

A single anomaly scores 0.3. A Sigma rule fires at severity "medium." A correlation alert adds 0.5. None of these individually cross an alert threshold — but together, on the same entity within a few hours, they paint a clear picture. Risk accumulation maintains a running score per entity where recent events contribute more than old ones, using exponential decay to let stale signals fade naturally.

---

## Real-World Examples

!!! example "Security: Entity Risk Rising Across Multiple Detections"
    IP `10.0.5.88` triggers three detections in 2 hours:

    1. **T+0:** Sigma rule "SSH brute-force" fires → +0.6 risk points
    2. **T+45m:** Correlation rule "brute-force-lateral-movement" fires → +0.8 risk points
    3. **T+90m:** Kill chain alert (3 tactics) → +0.7 risk points

    With a 6-hour half-life, by T+90m the first event has decayed to ~0.50. The cumulative risk
    is 0.50 + 0.73 + 0.70 = **1.94** — well above a typical threshold of 1.5. Without
    accumulation, no single event would have triggered an alert.

!!! example "Operations: Service Risk from Cascading Failures"
    Entity `api-gateway` accumulates risk during the v2.3.1 deployment:

    | Time | Detection | Risk Points | Cumulative |
    |------|-----------|-------------|------------|
    | T+0 | CUSUM change point (error rate) | 0.4 | 0.40 |
    | T+12m | Sigma rule (connection pool warning) | 0.5 | 0.89 |
    | T+18m | Correlation (errors + pool saturation) | 0.8 | 1.68 → **ALERT** |
    | T+30m | HST anomaly (OOM pattern) | 0.9 | 2.54 |

    The risk threshold alert at T+18m fires 12 minutes before the OOM crash. See the
    [Ops Primer](../ops-primer/ops-correlation.md) for the full scenario.

---

## Theory

### Why Accumulate Risk?

Individual event scores answer "is this event unusual?" Risk accumulation answers "is this entity in trouble?" The difference matters:

- **Volume:** 10 low-severity events on one entity in an hour is more concerning than 1 high-severity event
- **Diversity:** Alerts from different detectors (Sigma + ML + correlation) on the same entity reinforce each other
- **Recency:** An alert from 5 minutes ago matters more than one from yesterday

### Exponential Decay

Risk decays exponentially with a configurable half-life:

\[
\text{risk}(t) = \sum_{i} \text{points}_i \times e^{-\lambda \times (t - t_i)}
\]

where \(\lambda = \frac{\ln 2}{\text{half\_life}}\)

**Intuition:** After one half-life, a risk contribution is worth 50% of its original value. After two half-lives, 25%. After three, 12.5%. Old signals fade but never fully disappear until pruned.

| Half-Life | Use Case | Decay Speed |
|-----------|----------|-------------|
| 1 hour | Fast-moving attacks (brute-force, scanning) | Aggressive — signals fade quickly |
| 6 hours | General security monitoring | Balanced — default recommendation |
| 24 hours | Slow campaigns (APT, insider threat) | Conservative — long memory |

---

## Seerflow Implementation

### RiskRegister

The `RiskRegister` maintains per-entity lists of `RiskEntry` records, each with a timestamp, points, source, and optional ATT&CK context.

**RiskEntry fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timestamp_ns` | int | — | When the risk event occurred (nanoseconds) |
| `risk_points` | float | — | Points to add (typically 0.0-1.0) |
| `source` | string | — | Origin: `"ml"`, `"sigma"`, or `"correlation"` |
| `rule_name` | string | — | Which rule/detector generated this entry |
| `mitre_tactics` | tuple[str] | `()` | ATT&CK tactics if applicable |
| `mitre_techniques` | tuple[str] | `()` | ATT&CK techniques if applicable |

### Score Calculation

When `get_risk(entity_id)` is called, the register computes the decayed sum:

```python
now = time.time_ns()
total = 0.0
for entry in entries:
    age_ns = max(0, now - entry.timestamp_ns)
    total += entry.risk_points * math.exp(-lambda_ * age_ns)
```

**Worked example** with `half_life = 6 hours` (`lambda = ln(2) / 21,600,000,000,000 ns`):

| Entry | Points | Age | Decay Factor | Contribution |
|-------|--------|-----|-------------|--------------|
| Sigma alert | 0.6 | 90 min | \(e^{-\lambda \times 5.4 \times 10^{12}}\) ≈ 0.84 | 0.50 |
| Correlation | 0.8 | 45 min | \(e^{-\lambda \times 2.7 \times 10^{12}}\) ≈ 0.92 | 0.73 |
| Kill chain | 0.7 | 0 min | 1.00 | 0.70 |
| | | | **Total:** | **1.94** |

### Threshold Alerting

`check_threshold(entity_id)` returns `True` when `get_risk(entity_id) >= threshold`. This is a simple boolean check — the caller decides what to do with it (typically: emit a risk-threshold alert).

### Memory Management

- **Entity cap:** `max_entities` (default: 10,000) with LRU eviction
- **Entry cap:** `max_entries_per_entity` (default: 500) — keeps the most recent entries
- **Negligible pruning:** Entries whose decayed contribution drops below 0.01 are considered negligible and eligible for cleanup

---

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `half_life_ns` | int | — | Half-life in nanoseconds (e.g., 21,600,000,000,000 for 6h) |
| `threshold` | float | — | Risk score that triggers an alert |
| `max_entities` | int | `10,000` | Maximum tracked entities (LRU eviction) |
| `max_entries_per_entity` | int | `500` | Maximum risk entries per entity |

---

## Score Timeline

A visual representation of risk accumulation and decay over time:

```
Risk
Score
2.0 ┤                                          ╭── Kill chain alert
    │                                       ╭──╯
1.5 ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ THRESHOLD ─ ─╭╯─ ─ ─ ─ ─ ─ ─ ─ ─
    │                                  ╭──╯          ╲
1.0 ┤                              ╭──╯               ╲  decay
    │                          ╭──╯                     ╲
0.5 ┤              Correlation╭╯                         ╲
    │          ╭──╯                                       ╲
0.0 ┤ Sigma ──╯                                            ──
    └──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────
          T+0   T+15   T+30   T+45   T+60   T+75   T+90  minutes
```

Each detection adds a step up. Between detections, the curve decays exponentially. The threshold line shows where an alert would fire. After the last detection, risk decays back toward zero.

*This chart will be upgraded to an interactive Plotly.js visualization in S-139H.*

---

## See Also

- [Scoring & Attack Mapping](../detection/scoring.md) — how individual detector scores feed into risk points
- [Kill Chain Tracking](kill-chain.md) — kill chain alerts as a risk input source
- [Tuning Guide](../operations/tuning.md) — adjusting half-life and threshold for your environment

**Next:** [Graph-Structural Correlation](graph-structural.md)
