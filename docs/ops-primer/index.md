# Operational Intelligence Primer

> **No prior DevOps knowledge required.** This chapter introduces the core concepts you need to understand how Seerflow detects operational failures. Each section builds on the last — read them in order.

## Why This Chapter?

Most log intelligence documentation focuses on security — detecting attackers, matching threat signatures, mapping kill chains. That matters, but it's not the whole picture. For most engineering teams, **operational failures cause more day-to-day pain than security incidents**. A misconfigured deployment, a slow memory leak, a database connection pool running dry — these are the problems that wake people up at 3 AM.

Seerflow detects both. It treats infrastructure issues, application errors, and deployment regressions as first-class detection targets, not afterthoughts. This primer teaches the operational concepts you need to understand how that works: what failure patterns look like in logs, why deployments are high-risk windows, and how correlating signals across multiple sources turns scattered symptoms into actionable root-cause alerts.

!!! note "Seerflow's Dual-Mode Architecture"
    Seerflow ships with two detection families that can run independently or together, controlled by a single config switch:

    ```yaml
    detection:
      mode: operational  # or: security | both
    ```

    **Operational mode** activates 4 detectors tuned for infrastructure and application health:

    - **HST content** — spots unusual log message patterns (e.g., error messages that have never appeared before)
    - **Holt-Winters volume** — detects abnormal log volume spikes or drops (e.g., a service suddenly going silent)
    - **Markov sequence** — catches out-of-order event sequences (e.g., a startup routine that skips steps)
    - **CUSUM change-point** — catches gradual drifts and sustained mean shifts (e.g., memory slowly climbing before an OOM kill)

    **Security mode** activates 5 threat-focused detectors. **Both mode** runs all 9 in parallel. Most production deployments use `both`.

## By the End of This Chapter

You'll understand:

- What common **failure patterns** look like in log data — and why some failures are obvious while others hide in plain sight
- Why **deployments create risk windows** where baselines shift and normal detection thresholds stop working
- How **cross-source correlation** connects individually ambiguous signals into a single root-cause alert
- How Seerflow's operational detectors work together to catch failures that no single detector would flag

## Reading Order

These sections build on each other. Start at the top and work down:

| # | Section | What You'll Learn |
|---|---------|------------------|
| 1 | [Failure Patterns](failure-patterns.md) | Common infrastructure and application failure signatures in logs |
| 2 | [Deployment Risk](deployment-risk.md) | How deployments change baselines and what canary signals look like |
| 3 | [Ops Correlation](ops-correlation.md) | Cross-source correlation that turns scattered symptoms into root-cause alerts |

!!! tip "The Running Example"
    A single operational scenario threads through every section: **a team deploys v2.3.1 of their API service, and within 30 minutes, four log sources show escalating problems.** Application error rates climb from 1% to 8%. The database reports connection pool exhaustion. The reverse proxy shows latency spiking from 200ms to 2 seconds. And finally, the OS kernel logs an OOM kill.

    Each event is individually ambiguous — error rates fluctuate, connection pools hiccup, latency has bad days. But Seerflow correlates all four into a single **"deployment degradation"** alert, pinpointing v2.3.1 as the cause. By the end of this chapter, you'll understand exactly how.
