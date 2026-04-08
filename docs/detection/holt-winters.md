# Holt-Winters

!!! note "Coming Soon"
    This page will cover triple exponential smoothing for volume anomaly detection — level, trend, and seasonal decomposition with prediction bands.

!!! example "Operations: Connection Pool Trend Divergence"

    The `postgres-primary` database shows active connections climbing steadily after the v2.3.1 deploy, diverging from the expected daily seasonal pattern where connections drop during low-traffic hours.

    ```
    2026-04-08 03:18:22.451 UTC [pid=1842] LOG:  connection stats: active=45/50 idle=3 waiting=12
    2026-04-08 03:18:52.451 UTC [pid=1842] LOG:  connection stats: active=48/50 idle=1 waiting=28
    2026-04-08 03:19:22.451 UTC [pid=1842] WARNING:  remaining connection slots are reserved: active=50/50 waiting=41
    ```

    Seerflow's Holt-Winters detector catches this by decomposing the connection count into level, trend, and seasonal components — the upward trend after deploy diverges from the predicted seasonal trough, triggering a volume anomaly. See the [Ops Primer](../ops-primer/deployment-risk.md) for more on deployment risk windows.

## Theory

## Seerflow Implementation

## Practical Examples
