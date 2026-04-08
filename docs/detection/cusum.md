# CUSUM

!!! note "Coming Soon"
    This page will cover cumulative sum for change-point detection — detecting mean shifts in log volume or error rates.

!!! example "Operations: Deployment Change Point"

    At T+12 minutes after the v2.3.1 deploy, the error rate shifts from a stable 1% baseline to 8%. CUSUM detects this mean shift as a statistically significant change point — the exact moment the deployment started degrading service quality.

    ```json
    {"timestamp": "2026-04-08T03:12:00Z", "service": "api-service", "window": "1m",
     "requests": 1200, "errors": 96, "error_rate": 0.08, "baseline_rate": 0.01}
    {"timestamp": "2026-04-08T03:13:00Z", "service": "api-service", "window": "1m",
     "requests": 1180, "errors": 91, "error_rate": 0.077, "baseline_rate": 0.01}
    ```

    Seerflow's CUSUM detector catches this by accumulating the deviation between observed error rate and baseline — when the cumulative sum exceeds the threshold, it marks the exact change point at T+12. See the [Ops Primer](../ops-primer/deployment-risk.md) for how Seerflow uses change-point detection during deployments.

## Theory

## Seerflow Implementation

## Practical Examples
