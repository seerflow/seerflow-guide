---
title: Seerflow Guide
description: Comprehensive guide to Seerflow — streaming log intelligence
---

<span class="sf-eyebrow">The Guide · v0.5.0 · Read start to finish or jump in</span>

# Welcome to the <span class="sf-accent">Seerflow</span> Guide { .sf-hero-title }

**Seerflow** is a streaming, entity-centric log intelligence agent that detects operational
failures and security threats across log sources. It combines traditional ML for bulk detection
with LLMs for edge cases and root cause analysis.

<p class="sf-tagline">See what single sources can't.</p>

## Who is this guide for?

Two reading paths — pick yours. Both end at the same place: a well-tuned Seerflow in production.

<div class="sf-grid cols-2" markdown>
<div class="sf-card" markdown>
<span class="sf-card-label">Path 01</span>
<span class="sf-card-title">Security Operator</span>

Deploying or tuning Seerflow.

1. [Architecture](architecture/index.md) — pipeline and data flow
2. [Detection Deep Dives](detection/index.md) — understand each detector
3. [Tuning Guide](operations/tuning.md) — reduce false positives
4. [Configuration Reference](reference/config.md) — every parameter
</div>
<div class="sf-card" markdown>
<span class="sf-card-label">Path 02</span>
<span class="sf-card-title">SRE / DevOps</span>

Running infra and wanting log intelligence.

1. [Ops Primer](ops-primer/index.md) — operational intelligence concepts
2. [Architecture](architecture/index.md) — how Seerflow processes logs
3. [Detection](detection/index.md) — anomaly detection for ops patterns
4. [Tuning Guide](operations/tuning.md) — reduce noise, focus on real issues
</div>
</div>

## How Seerflow works

Eight stages, one process. Feedback from analyst response loops back into the detection thresholds.

<div class="sf-flow">
<div class="sf-flow__row">
<div class="sf-flow__box"><span class="sf-flow__n">A</span><span class="sf-flow__label">Log Sources</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">B</span><span class="sf-flow__label">Receivers</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">C</span><span class="sf-flow__label">Parsing · Drain3</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">D</span><span class="sf-flow__label">Entity Extraction</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">E</span><span class="sf-flow__label">Detection Ensemble</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">F</span><span class="sf-flow__label">Correlation Engine</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">G</span><span class="sf-flow__label">Alerting</span></div>
</div>
<p class="sf-flow__feedback">Feedback loop H · Threshold adjustment <span class="sf-loop">↩</span></p>
</div>

| Component | Purpose |
|-----------|---------|
| **Receivers** | Ingest logs from syslog, files, OTLP, webhooks |
| **Parsing** | Drain3 template extraction, field normalization |
| **Entity Extraction** | Identify IPs, users, hosts, processes, files, domains |
| **Detection Ensemble** | HST, Holt-Winters, CUSUM, Markov, DSPOT thresholds |
| **Correlation** | Sigma rules, temporal windows, kill chain, graph analysis |
| **Alerting** | Webhooks (Slack, Teams, PagerDuty), dedup, feedback |

## Guide structure

Every concept page follows a three-layer structure:

<div class="sf-grid cols-3" markdown>
<div class="sf-card" markdown>
<span class="sf-card-label">Step 01</span>
<span class="sf-card-title">Theory</span>

What it is, why it matters.
</div>
<div class="sf-card" markdown>
<span class="sf-card-label">Step 02</span>
<span class="sf-card-title">Seerflow Implementation</span>

How it's built, with code references.
</div>
<div class="sf-card" markdown>
<span class="sf-card-label">Step 03</span>
<span class="sf-card-title">Practical Examples</span>

Real scenarios, config samples, expected output.
</div>
</div>

## Source code

Seerflow is open source under AGPL-3.0.

[github.com/seerflow/seerflow ↗](https://github.com/seerflow/seerflow){ .sf-btn .outline }
