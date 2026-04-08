# Graph-Structural Analysis

!!! note "Coming Soon"
    This page will cover graph-based anomaly detection — community crossing, betweenness spikes, fan-out bursts, and how graph structure reveals lateral movement.

## Real-World Examples

=== "Security"

    **Threat Actor Pivoting:** An attacker compromises `web-frontend`, then uses stored credentials to reach `postgres-primary`, and pivots to `redis-cache` to extract session tokens. Seerflow's entity graph detects the unusual community-crossing pattern — `web-frontend` and `redis-cache` are in different graph communities, and a single actor bridging them produces a betweenness spike.

=== "Operations"

    **Failure Propagation Through Service Dependencies:** The v2.3.1 deployment cascades through service dependencies visible in the entity graph:

    ```mermaid
    graph LR
        A[api-gateway] -->|DB queries| B[postgres-primary]
        A -->|cache reads| C[redis-cache]
        B -.->|pool exhaustion<br/>propagates back| A
        A -.->|timeout errors<br/>cascade to| C
    ```

    `api-gateway` errors cause connection pool pressure on `postgres-primary`, which in turn increases `api-gateway` latency, which cascades timeouts to `redis-cache`. Seerflow detects this through fan-out analysis — `api-gateway` suddenly has anomalous edge weights to both `postgres-primary` and `redis-cache`, a pattern that doesn't appear during normal operation. See the [Ops Primer](../ops-primer/ops-correlation.md) for the full cross-source correlation walkthrough.

## Theory

## Seerflow Implementation

## Practical Examples
