# Half-Space Trees (HST)

!!! note "Coming Soon"
    This page will cover HST for content anomaly detection — how isolation forests work in a streaming context, feature space visualization, and tuning parameters.

!!! example "Operations: Novel Error Patterns After Deployment"

    After deploying v2.3.1 of `api-gateway`, HST detects a spike in 500 errors with stack traces never seen before — a new error cluster outside the training baseline.

    ```json
    {"timestamp": "2026-04-08T03:12:47Z", "service": "api-gateway", "level": "ERROR",
     "status": 500, "path": "/api/orders", "duration_ms": 12340,
     "error": "NullPointerException in OrderService.validate(OrderService.java:142)"}
    {"timestamp": "2026-04-08T03:12:48Z", "service": "api-gateway", "level": "ERROR",
     "status": 500, "path": "/api/orders/batch", "duration_ms": 15200,
     "error": "NullPointerException in OrderService.validate(OrderService.java:142)"}
    ```

    Seerflow's HST detector catches this by isolating the novel error template in feature space — these stack traces have no historical precedent, producing a high anomaly score even at low volume. See the [Ops Primer](../ops-primer/failure-patterns.md) for more failure pattern examples.

## Theory

## Seerflow Implementation

## Practical Examples
