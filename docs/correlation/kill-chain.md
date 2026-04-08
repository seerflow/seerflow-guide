# Kill Chain Tracking

!!! note "Coming Soon"
    This page will cover per-entity MITRE ATT&CK tactic progression tracking — how Seerflow detects multi-stage attacks as an attacker advances through kill chain stages.

## Real-World Examples

=== "Security"

    **ATT&CK Tactic Progression:** An attacker moves through reconnaissance (port scanning) → initial access (SSH brute-force) → lateral movement (internal SSH pivots) → exfiltration (large outbound transfer). Seerflow tracks each tactic per-entity and fires a kill chain alert when three or more stages are observed for the same actor within the correlation window.

=== "Operations"

    **Failure Cascade Chain:** The v2.3.1 deployment triggers a failure chain that mirrors a kill chain progression — each stage escalates severity:

    | Time | Stage | Signal |
    |------|-------|--------|
    | T+0  | **Deploy** | New image `api-service:v2.3.1` rolled out |
    | T+12 | **Error spike** | 500 error rate jumps from 1% to 8% (CUSUM change point) |
    | T+18 | **Resource exhaustion** | `postgres-primary` connection pool saturated (Sigma rule) |
    | T+30 | **Crash** | `api-service` pod OOM killed (HST + system log anomaly) |

    Seerflow tracks this as an operational kill chain: each stage accumulates risk score on the `api-service` entity. By T+18, the combined score crosses the alert threshold — 12 minutes before the OOM crash. See the [Ops Primer](../ops-primer/ops-correlation.md) for the full entity graph view.

## Theory

## Seerflow Implementation

## Practical Examples
