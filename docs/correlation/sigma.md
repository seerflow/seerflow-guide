# Sigma Rules

!!! note "Coming Soon"
    This page will cover Seerflow's Sigma integration — rule anatomy, pySigma compilation, logsource-indexed dispatch, bundled rules, and writing custom rules.

## Real-World Examples

=== "Security"

    **SSH Brute-Force Detection:** A Sigma rule triggers when 50+ failed SSH authentication attempts originate from a single IP within 5 minutes. Seerflow's pySigma engine compiles the rule into a log filter and dispatches it via logsource-indexed routing — the rule only evaluates against `auth.log` sources, not all logs.

=== "Operations"

    **Connection Pool Exhaustion Pattern:** A custom Sigma rule detects when `postgres-primary` logs three or more `remaining connection slots are reserved` warnings within 2 minutes — a pattern that precedes full pool exhaustion and cascading request failures.

    ```
    2026-04-08 03:18:22 UTC WARNING:  remaining connection slots are reserved: active=50/50 waiting=28
    2026-04-08 03:19:22 UTC WARNING:  remaining connection slots are reserved: active=50/50 waiting=41
    2026-04-08 03:20:22 UTC WARNING:  remaining connection slots are reserved: active=50/50 waiting=55
    ```

    In the v2.3.1 deployment scenario, this Sigma rule fires at T+18 — before the OOM kill at T+30 — giving operators a window to roll back. See the [Ops Primer](../ops-primer/ops-correlation.md) for how rule-based detection combines with ML anomaly scores.

## Theory

## Seerflow Implementation

## Practical Examples
