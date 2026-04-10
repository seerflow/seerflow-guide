# Operations Guide

Everything you need to deploy, configure, and run Seerflow in production.

## Prerequisites

Before starting Seerflow, ensure you have:

- **Python 3.11+** installed
- **uv** package manager ([install guide](https://docs.astral.sh/uv/getting-started/installation/))
- **Seerflow** installed: `uv pip install seerflow`
- A **configuration file** (`seerflow.yaml`) — see [Configuration Reference](../reference/config.md) for all options

## Quick Start

```bash
# 1. Create a minimal config (or copy the example)
cat > seerflow.yaml << 'EOF'
storage:
  backend: sqlite

receivers:
  syslog_enabled: true
  otlp_grpc_enabled: true

detection:
  hst_window_size: 1000
  dspot:
    risk_level: 0.0001
EOF

# 2. Start the pipeline
seerflow start

# 3. Verify it's running
seerflow query health
```

Seerflow starts with sensible defaults — no config file is needed for a first run. The pipeline will listen on syslog (UDP 514, TCP 601) and OTLP (gRPC 4317, HTTP 4318) by default.

## Reading Order

| Audience | Recommended path |
|----------|-----------------|
| **Security operator** | [Alerting](alerting.md) → [Configuration](../reference/config.md) → [CLI](../reference/cli.md) → [Tuning](tuning.md) |
| **Platform engineer** | [Storage](storage.md) → [Configuration](../reference/config.md) → [Testing](testing.md) → [Tuning](tuning.md) |
| **Contributor** | [Testing](testing.md) → [Storage](storage.md) → [Configuration](../reference/config.md) → [CLI](../reference/cli.md) |

## Section Overview

| Page | What you'll learn |
|------|-------------------|
| [Alerting & Feedback](alerting.md) | Alert lifecycle, webhook sinks (Slack/Teams/JSON), OTLP export, PagerDuty, TP/FP feedback loop |
| [Storage Layer](storage.md) | Protocol interfaces, SQLite backend (WAL, FTS5), PostgreSQL migration, model persistence |
| [Tuning Guide](tuning.md) | False positive reduction, per-detector tuning, correlation tuning, performance budgets |
| [Testing & Validation](testing.md) | Quality gates, test structure, LANL dataset validation, custom rule testing |
| [Configuration Reference](../reference/config.md) | Every YAML parameter with type, default, and description |
| [CLI Reference](../reference/cli.md) | All 5 subcommands: start, tail, import, query, feedback |
