# The Deployment Risk Window

Every deployment changes what "normal" looks like. New log templates appear. Error rates shift. Latency profiles move. The 30 to 60 minutes after a deployment are the highest-risk period for any production system --- most incidents trace back to a recent change. Industry post-mortems consistently confirm it: the single strongest predictor of an outage is "someone deployed something."

The challenge is not detecting change --- change is the whole point of deploying. The challenge is distinguishing **expected change from new code** from **regression that will become an outage**. A 0.3% increase in error rate might be a healthy new code path handling more edge cases. A 5% increase that keeps climbing is a broken database query eating your connection pool. Both show up as "error rate went up." The difference is life or death for your SLO.

---

## What Changes After a Deployment

When new code hits production, four things shift simultaneously:

**New log templates.** New code paths produce log messages the system has never seen. Drain3 --- Seerflow's streaming template extractor --- will parse these into new templates. A message like `Retrying request to inventory-service after timeout (attempt 2/3)` might never have existed before v2.3.1 introduced a retry loop. That is expected.

**Error rate shifts.** New features often handle more edge cases, which can legitimately increase error rates. A new input validation layer rejects malformed requests that previously slipped through silently --- the error count rises, but the system is *healthier*.

**Latency profile changes.** Different code paths mean different database queries, different serialization costs, different downstream calls. A new endpoint that joins three tables will have a different latency signature than the simple key lookup it replaced.

**Volume pattern shifts.** New endpoints attract traffic. Deprecated endpoints lose it. Background jobs run on different schedules. The overall shape of "how many logs per minute" changes.

The key insight: all of these are **expected**. The problem is when the change is *too much* or *in the wrong direction*. A new template appearing once per minute is normal. A new error template appearing 500 times per minute and accelerating is not.

---

## Baseline Shift vs. Regression

A **baseline** is what Seerflow's streaming models have learned as "normal" from historical data. Each detector maintains its own baseline: CUSUM tracks the running mean of error rates, Holt-Winters models seasonal volume patterns, Half-Space Trees map the density of content features, and Markov Chains learn the expected order of events. Together, these baselines define what your system looks like when it is healthy.

A deployment creates a **baseline shift** --- the old normal no longer applies. The question is whether the new normal is still healthy.

Two kinds of post-deployment changes look very different in the data:

**Legitimate shift.** Error rate goes from 0.5% to 0.8% because new code handles more edge cases. The increase is modest, it stabilizes quickly, and no other signals correlate with it. The system is operating differently but well.

**Regression.** Error rate goes from 0.5% to 5% and keeps climbing. Connection pool warnings appear in the database logs. Latency tails grow. Something is broken, and it is getting worse.

Seerflow's streaming models distinguish these two cases by combining signals:

- **CUSUM** detects the **change point** --- the exact moment something shifted. In our v2.3.1 scenario, CUSUM fires at T+12 minutes: "the error rate mean shifted at 14:12."
- **Holt-Winters** compares the new pattern against the **seasonal baseline** --- what volume *should* look like at this time of day, this day of the week. "The current error volume is 10x higher than expected for a Tuesday afternoon."
- The combination gives confidence. A shift within 2x of the historical baseline is probably a legitimate deployment artifact. A shift that is 10x the baseline and still climbing is almost certainly a regression. Neither signal alone is conclusive --- together they are.

---

## Canary Signals

Production outages rarely arrive without warning. Early signals --- **canary signals** --- appear in the logs 5 to 15 minutes before the full failure. The problem is that each signal, taken alone, looks ambiguous. Taken together, they tell a clear story.

Four canary signals appear consistently in deployment-related incidents:

**Error rate creep.** Not a spike --- a climb. The error rate goes from 1% to 2% to 3% to 5% over the course of 10 minutes. Each individual measurement looks like normal fluctuation. The trend is the signal. CUSUM is purpose-built for this: it accumulates small deviations until the cumulative sum crosses a threshold, catching gradual drifts that spike detectors miss entirely.

**Latency tail growth.** The median (p50) response time looks fine. But p99 --- the slowest 1% of requests --- is 10x normal. A few requests are struggling badly. This often means a resource is under contention: a connection pool nearing exhaustion, a disk approaching capacity, a lock being held too long. Most dashboards show averages. The tail is where regressions hide.

**New template clusters.** Drain3 extracts log templates in real time. When a deployment introduces a regression, new error templates appear that have no historical precedent. Half-Space Trees flag these immediately --- a template the model has never seen occupies a sparse region of the feature space and scores high on content anomaly.

**Connection warnings.** Resources fail in stages. A connection pool does not go from "healthy" to "exhausted" in one step. First: `Connection pool at 80% capacity`. Then: `Connection pool at 95% capacity`. Then: `Cannot acquire connection: pool exhausted`. The warnings are the canary. If you catch the 80% warning, you have minutes to act before exhaustion.

These signals appear in the window between "something changed" and "the pager fires." Seerflow catches them because streaming ML evaluates every event as it arrives --- there is no five-minute batch cycle to wait through. Contrast that with traditional batch monitoring: if your checks run every five minutes, the entire canary window might fall between two polling intervals. By the time the next check runs, the pool is already exhausted.

---

## Rollback Triggers

Not every deployment regression requires a rollback. But some patterns are clear enough to act on immediately. Four log-derived signals should trigger a rollback decision:

- **Error rate exceeds 3x the pre-deployment baseline.** A 0.5% baseline that climbs past 1.5% and is still rising warrants immediate investigation. Past 3x with no sign of stabilization, roll back.
- **New error templates appearing at an accelerating rate.** One new template is expected. Ten new error templates in five minutes, with the rate increasing, means the new code is hitting failure paths the team did not anticipate.
- **p99 latency exceeds the SLO threshold.** If your SLO promises 500ms at p99 and the deployment pushes it past 2 seconds, the deployment is violating your contract with users.
- **Any OOM kill or crash loop.** An out-of-memory kill recorded in system logs (`oom-kill` or `OOMKilled`) means a process consumed more memory than the kernel allowed, and the kernel terminated it to protect the host. This is never a legitimate baseline shift. Roll back and investigate.

Seerflow can alert on these patterns automatically. **DSPOT** --- the adaptive threshold engine based on Extreme Value Theory --- learns what "extreme" looks like from recent score distributions rather than relying on static thresholds a human configured months ago. When a deployment pushes anomaly scores into territory that DSPOT considers extreme relative to recent history, an alert fires without anyone needing to manually adjust a threshold.

---

## The v2.3.1 Failure Cascade

Here is the full timeline of the v2.3.1 deployment failure, showing how symptoms cascade across log sources and when Seerflow's detectors fire. Hover any bar for source and severity details. Green diamonds mark instant events (deploy, Seerflow alerts, OOM kill); colored bars show the duration of each degradation phase.

<div class="seerflow-viz"
     data-viz="deployment-cascade"
     data-src="../../assets/viz-data/deployment-cascade.json"
     style="min-height: 540px;"></div>

The cascade tells a story: a new database query in v2.3.1 was less efficient than the one it replaced. Under load, it held connections longer, draining the pool. As the pool thinned, requests backed up, latency climbed, and the application buffered more data in memory trying to compensate. Eventually, memory pressure triggered an OOM kill.

Seerflow's first signal fired at T+12 --- eighteen minutes before the OOM kill. The blended alert, combining CUSUM change-point detection with Holt-Winters volume divergence, fired at T+20 at moderate severity. As more sources correlated (proxy latency at T+24, OOM at T+30), the score continued climbing to critical. A team monitoring alerts had a 10-minute window to roll back before the outage became user-facing.

---

## Configuration

The following config focuses Seerflow on operational detection --- infrastructure and application health patterns without security rule overhead:

```yaml
detection:
  mode: operational
  cusum:
    drift: 0.5
    threshold: 5.0
  holt_winters:
    seasonal_period: 1440  # daily cycle in minutes
    alpha: 0.3
    beta: 0.1
    gamma: 0.1
```

The `drift` parameter controls CUSUM's sensitivity to small shifts (lower values catch smaller deviations), and `threshold` sets how much cumulative deviation triggers a change-point signal. The Holt-Winters `seasonal_period` of 1440 minutes (one day) means the model learns daily traffic patterns --- weekday vs. weekend, business hours vs. off-hours --- and flags deviations from the expected cycle.

---

!!! info "How Seerflow Uses This"

    Three detectors work together during the deployment risk window:

    - **CUSUM** catches the change point immediately after a deploy --- it detected the error rate shift at T+12 in the v2.3.1 scenario, before any other signal was clearly abnormal.
    - **Holt-Winters** compares the new pattern against the seasonal baseline, answering "is this expected for a Tuesday afternoon?" A 10x deviation from the daily forecast is a strong regression signal.
    - **Streaming adaptation** means Seerflow's models update with every event. After a confirmed good deploy, baselines adjust within hours. There is no manual retrain step, no "suppress alerts for the next 30 minutes" workaround.

    The `mode: operational` config activates infrastructure and application detectors without loading security rules, reducing overhead for teams focused purely on deployment safety and SLO compliance.

    Each of these signals --- error cascade, pool exhaustion, latency spike, OOM --- appeared in a different log source. No single source told the whole story. The application logs showed errors but not *why*. The database logs showed pool exhaustion but not *what caused it*. The proxy logs showed latency but not *where* in the stack the bottleneck lived. Only by correlating events across all four sources could you trace the failure from root cause (inefficient query) to final symptom (OOM kill).

    **Next:** [Cross-Source Correlation &rarr;](ops-correlation.md)
