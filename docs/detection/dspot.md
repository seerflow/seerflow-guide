# DSPOT Adaptive Thresholds

!!! note "Coming Soon"
    This page will cover DSPOT/biDSPOT for automatic threshold setting — extreme value theory, GPD tail fitting, and how thresholds auto-adjust over time.

!!! example "Operations: Latency Tail Auto-Threshold"

    After the v2.3.1 deploy, p99 latency climbs from 200ms to 2s as connection pool exhaustion forces requests to queue. DSPOT dynamically raises its anomaly threshold based on the tail distribution — but the post-deploy spike exceeds even the adapted bound.

    ```json
    {"timestamp": "2026-04-08T03:18:00Z", "service": "api-service", "metric": "p99_latency_ms",
     "value": 1847, "dspot_threshold": 892, "exceeded": true}
    {"timestamp": "2026-04-08T03:19:00Z", "service": "api-service", "metric": "p99_latency_ms",
     "value": 2103, "dspot_threshold": 921, "exceeded": true}
    ```

    Seerflow's DSPOT detector catches this by fitting a Generalized Pareto Distribution to the latency tail — the threshold auto-adjusts for seasonal variation, but the post-deploy values lie well beyond the expected extreme. See the [Ops Primer](../ops-primer/deployment-risk.md) for how deployment risk windows interact with adaptive thresholds.

## Theory

## Seerflow Implementation

## Practical Examples
