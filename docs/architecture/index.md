# Architecture & Pipeline

## The Problem: Too Many Logs, Not Enough Signal

Modern infrastructure generates millions of log events per day. Security teams drown in alerts they can't triage. Operations teams miss failures buried in noise. Traditional tools force a choice: rule-based SIEMs that catch known threats but miss novel ones, or ML-only platforms that flag anomalies but can't explain them.

Seerflow takes a different approach: **one streaming pipeline that serves both security and operations**, combining rules (fast, explainable) with machine learning (adaptive, catches unknowns).

## The Dual-Lens Approach

Every log event passes through the same pipeline, but two lenses interpret it:

- **Security lens:** Is this a brute-force attack? A lateral movement attempt? Does it match a Sigma detection rule?
- **Operations lens:** Is this a deployment failure? A memory leak? An anomalous error rate spike?

The architecture doesn't care which lens matters — it processes every event through parsing, detection, correlation, and alerting. The detectors and rules decide what's interesting.

## How Seerflow Compares

| Dimension | Traditional SIEM | Pure-ML Tool | Seerflow |
|-----------|-----------------|-------------|----------|
| Detection approach | Rules only | ML only | ML + rules hybrid |
| Latency | Batch (minutes) | Batch (minutes) | Streaming (seconds) |
| New log formats | Manual parsers | Retraining required | Drain3 auto-templates |
| Explainability | High (rules are readable) | Low (black box) | High (rules + LLM edge cases) |
| Coverage | Known threats only | Anomalies only | Known + unknown |
| Cost model | Per-GB ingest pricing | GPU compute | CPU-only streaming |

## Pipeline Overview

Every log event flows through five stages:

```mermaid
graph LR
    A["📡 Receivers"] --> B["📬 Queue<br/><small>10K max · backpressure at 80%</small>"]
    B --> C["🔍 Parser<br/><small>Drain3 + Entity Extraction</small>"]
    C --> D["🧠 Detection<br/><small>5 ML models + Sigma rules</small>"]
    D --> E["🔗 Correlation<br/><small>Entity graph · Risk · Kill chain</small>"]
    E --> F["🔔 Alerting<br/><small>Webhook · PagerDuty</small>"]

    style B fill:#f9f,stroke:#333,stroke-width:1px
```

**Receivers** ingest logs from syslog, files, OpenTelemetry, and webhooks. A bounded asyncio queue (10,000 events max) absorbs bursts and applies backpressure at 80% utilization. The **parser** uses Drain3 for streaming template extraction and regex-based entity extraction. **Detection** runs five online ML models (Half-Space Trees, Holt-Winters, CUSUM, Markov chains, DSPOT thresholds) plus Sigma rule matching. **Correlation** connects related events through an entity graph, risk accumulation, and kill-chain tracking. **Alerting** dispatches to webhooks and PagerDuty with deduplication.

The entire pipeline runs in a single asyncio event loop — no threads, no GIL contention, predictable memory.

## A Preview: Two Events, One Pipeline

=== "🔒 Security"

    **Scenario:** An attacker brute-forces SSH credentials on `web-prod-01`.

    ```text
    Mar 15 03:14:07 web-prod-01 sshd[12345]: Failed password for root from 198.51.100.23 port 44123
    ```

    This log enters via the **syslog receiver**, gets parsed by Drain3 into template `Failed password for <*> from <*> port <*>`, entities `{user: root, ip: 198.51.100.23}` are extracted, the **detection ensemble** scores it as anomalous, and the **correlation engine** links it to prior failed attempts from the same IP — escalating the risk score.

    Follow this event through each pipeline stage in the pages below.

=== "⚙️ Operations"

    **Scenario:** A canary deploy triggers OOMKill events in Kubernetes.

    ```text
    2026-03-15T10:22:14Z nginx-canary-7f8b9 exceeded memory limit 512Mi, OOMKilled
    ```

    This event arrives via the **webhook receiver** (Kubernetes event hook), Drain3 extracts template `<*> exceeded memory limit <*>, OOMKilled`, the entity `{process: nginx-canary-7f8b9}` is extracted, the **detection ensemble** flags the volume spike, and **correlation** links it to the deploy event — identifying the canary as the root cause.

    Follow this event through each pipeline stage in the pages below.

## Who Is This Guide For?

| You are a... | Start here | Then read |
|--------------|-----------|-----------|
| **Operator** setting up Seerflow | This page → [Receivers](receivers.md) | [Operations](../operations/index.md) for alerting and tuning |
| **Contributor** working on the codebase | [Pipeline](pipeline.md) → [Parsing](parsing.md) | [Event Model](event-model.md) for the core data structure |
| **Security analyst** evaluating Seerflow | Skim this page → [Security Primer](../security-primer/index.md) | [Detection](../detection/index.md) → [Correlation](../correlation/index.md) |
