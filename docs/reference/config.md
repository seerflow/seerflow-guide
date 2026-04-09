# Configuration Reference

## Graph & Correlation

Parameters for graph-structural anomaly detection. These control when the entity graph generates alerts based on structural patterns.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph.betweenness_threshold` | `float` | `0.3` | Alert when betweenness centrality exceeds this value. Range: 0.0-1.0. |
| `graph.betweenness_risk_multiplier` | `float` | `1.5` | Multiplied by raw betweenness for risk score, capped at 1.0. |
| `graph.fan_out_sigma` | `float` | `3.0` | Standard deviations above mean for fan-out burst detection. |
| `graph.fan_out_history_size` | `int` | `20` | Rolling window sample size for fan-out baseline calculation. |
| `graph.fan_out_min_floor` | `int` | `5` | Minimum outgoing connections before fan-out alerting triggers. |
| `graph.community_crossing_risk` | `float` | `0.6` | Fixed risk score assigned to community crossing alerts. |
| `graph.community_crossing_enabled` | `bool` | `true` | Enable or disable community crossing detection. |

!!! example "Configuration Example"
    ```yaml
    graph:
      betweenness_threshold: 0.4       # raise for environments with many bridge nodes
      fan_out_sigma: 2.5               # lower for stricter fan-out detection
      fan_out_min_floor: 10            # raise for larger networks
      community_crossing_enabled: true
    ```

For detailed explanations of each parameter, see [Algorithms & Detection](../entity-graph/algorithms.md) and [Graph-Structural Correlation](../correlation/graph-structural.md).

## Detection

Parameters for the ML anomaly detection ensemble. These control how each detector behaves, how scores are blended, and when alerts fire.

### Half-Space Trees

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hst_n_trees` | `int` | `25` | Number of half-space trees. More trees = more stable scores, more memory (~2 KB/tree). |
| `detection.hst_window_size` | `int` | `1000` | Sliding window for mass updates. Larger = slower adaptation, fewer false positives. |

### Holt-Winters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hw_seasonal_period` | `int` | `1440` | Seasonal period in 1-min buckets. 1440 = 24 hours. |
| `detection.hw_alpha` | `float` | `0.3` | Level smoothing factor (0.0–1.0). Higher = faster reaction to level changes. |
| `detection.hw_beta` | `float` | `0.1` | Trend smoothing factor (0.0–1.0). Higher = faster reaction to trend changes. |
| `detection.hw_gamma` | `float` | `0.1` | Seasonal smoothing factor (0.0–1.0). Higher = faster seasonal adaptation. |
| `detection.hw_n_std` | `float` | `3.0` | Prediction band width in standard deviations. |

### CUSUM

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.cusum_drift` | `float` | `0.5` | Allowable drift before accumulation. Higher = less sensitive to small shifts. |
| `detection.cusum_threshold` | `float` | `5.0` | Cumulative sum threshold for change-point declaration. |
| `detection.cusum_ema_alpha` | `float` | `0.1` | EMA smoothing for baseline mean/variance tracking. |
| `detection.cusum_warmup_buckets` | `int` | `30` | Minutes of warmup before scoring begins. |

### Markov Chains

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.markov_smoothing` | `float` | `1e-6` | Laplace smoothing for unseen transitions. Lower = higher scores for novel sequences. |
| `detection.markov_min_events` | `int` | `100` | Minimum events per entity before scoring begins. |
| `detection.markov_max_entities` | `int` | `1000` | LRU cap on tracked entities. Memory: ~10 KB per entity. |

### DSPOT Thresholds

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.dspot_calibration_window` | `int` | `1000` | Scores collected before GPD fitting. No anomalies during calibration. |
| `detection.dspot_risk_level` | `float` | `0.0001` | Target false positive rate (0.01%). Lower = higher threshold. |
| `detection.dspot_initial_percentile` | `int` | `98` | Percentile for initial threshold. Upper at P-th, lower at (100-P)-th. |

### Blending Weights

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.weights_content` | `float` | `0.30` | HST weight in blended score. |
| `detection.weights_volume` | `float` | `0.25` | Holt-Winters (per-source) weight in blended score. |
| `detection.weights_sequence` | `float` | `0.25` | Markov weight in blended score. |
| `detection.weights_pattern` | `float` | `0.20` | CUSUM weight in blended score. |
| `detection.weights_template_volume` | `float` | `0.15` | Per-template Holt-Winters weight in blended score. |
| `detection.weights_entity_volume` | `float` | `0.15` | Per-entity Holt-Winters weight in blended score. |

Weights don't need to sum to 1.0 — only the ratios between them matter.

### Ensemble Limits

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.max_sources` | `int` | `256` | LRU cap on per-source detector instances. |
| `detection.max_template_hw` | `int` | `500` | LRU cap on per-template Holt-Winters instances. |
| `detection.max_entity_hw` | `int` | `500` | LRU cap on per-entity Holt-Winters instances. |
| `detection.model_save_interval_seconds` | `int` | `300` | Checkpoint interval in seconds. |
| `detection.score_interval` | `int` | `1` | Score every N-th event per source. Set > 1 to reduce CPU. |
| `detection.min_events_for_scoring` | `int` | `50` | Events before ensemble starts scoring a new source. |

!!! example "Configuration Example"
    ```yaml
    detection:
      hst_window_size: 2000       # larger window for noisy environments
      hw_n_std: 4.0               # wider prediction band, fewer false positives
      cusum_drift: 0.3            # more sensitive to small shifts
      dspot_risk_level: 0.001     # lower threshold, more alerts
      weights_content: 0.35       # emphasize content novelty
      max_sources: 512            # more sources before eviction
    ```

For detailed explanations of each parameter and tuning advice, see the individual detector pages: [HST](../detection/hst.md), [Holt-Winters](../detection/holt-winters.md), [CUSUM](../detection/cusum.md), [Markov](../detection/markov.md), [DSPOT](../detection/dspot.md), [Scoring](../detection/scoring.md).
