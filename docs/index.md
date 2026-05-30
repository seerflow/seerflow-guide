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

<div class="sf-grid cols-2" markdown>
<div class="sf-card" markdown>
<span class="sf-card-label">Path 01</span>
<span class="sf-card-title">Security Operator</span>

Deploying or tuning Seerflow? Go here:

1. [Architecture](architecture/index.md) — pipeline and data flow
2. [Detection Deep Dives](detection/index.md) — understand each detector
3. [Tuning Guide](operations/tuning.md) — reduce false positives
4. [Configuration Reference](reference/config.md) — every parameter
</div>
<div class="sf-card" markdown>
<span class="sf-card-label">Path 02</span>
<span class="sf-card-title">SRE / DevOps</span>

Running infrastructure and want log intelligence?

1. [Ops Primer](ops-primer/index.md) — operational intelligence concepts
2. [Architecture](architecture/index.md) — how Seerflow processes logs
3. [Detection](detection/index.md) — anomaly detection for ops patterns
4. [Tuning Guide](operations/tuning.md) — reduce noise, focus on real issues
</div>
</div>

## How Seerflow works

Logs flow through a streaming pipeline. Each stage adds context: raw lines become structured
events, events resolve to entities, entities accrue risk, and risk crosses thresholds into alerts.

<div class="sf-flow">
<div class="sf-flow__row">
<div class="sf-flow__box"><span class="sf-flow__n">01</span><span class="sf-flow__label">Sources</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">02</span><span class="sf-flow__label">Receivers</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">03</span><span class="sf-flow__label">Parse · Drain3</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">04</span><span class="sf-flow__label">Entities</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">05</span><span class="sf-flow__label">Detect</span></div>
<div class="sf-flow__box"><span class="sf-flow__n">06</span><span class="sf-flow__label">Correlate</span></div>
<div class="sf-flow__box is-accent"><span class="sf-flow__n">07</span><span class="sf-flow__label">Alert</span></div>
</div>
<p class="sf-flow__feedback"><span class="sf-loop">↺</span> Feedback: alert outcomes tune detector thresholds</p>
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

Seerflow is open source.

[github.com/seerflow/seerflow](https://github.com/seerflow/seerflow){ .sf-btn .primary }
