# Markov Chains

!!! note "Coming Soon"
    This page will cover Markov chain sequence anomaly detection — state transitions, transition matrices, and detecting unusual event sequences.

!!! example "Operations: Service Restart Sequence Deviation"

    After OOM kills at T+30, `api-service` pods restart — but the init sequence is abnormal. The container starts the health check endpoint before the database migration completes, causing a cascade of failed readiness probes.

    ```
    EVENT  03:30:14  Pod api-service-7f8d9 OOMKilled (exit code 137)
    EVENT  03:30:16  Pod api-service-7f8d9 Pulling image api-service:v2.3.1
    EVENT  03:30:22  Pod api-service-7f8d9 Started container api-service
    EVENT  03:30:23  Pod api-service-7f8d9 Readiness probe failed: connection refused
    EVENT  03:30:24  Pod api-service-7f8d9 Started migration runner
    ```

    Seerflow's Markov detector catches this by modeling the expected state transition sequence (pull → start → migrate → health check). The observed sequence (start → health check → migrate) has near-zero transition probability in the learned model. See the [Ops Primer](../ops-primer/failure-patterns.md) for more on sequence-based failure detection.

## Theory

## Seerflow Implementation

## Practical Examples
