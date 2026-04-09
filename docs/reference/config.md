# Configuration Reference

!!! note "Coming Soon"
    This page will provide a complete reference for all YAML configuration parameters — with types, defaults, descriptions, and examples.

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
