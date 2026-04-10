# Testing & Validation

Seerflow enforces a **95% coverage floor** across the full source tree. Every change to `src/seerflow/` must pass five sequential quality gates before it can be merged — linting, formatting, type checking, security scanning, and the test suite. This page explains each gate, how tests are organized, how to validate against real log data using the LANL dataset, and how to test custom Sigma and correlation rules.

## Quick Start

Run all five quality gates in a single command:

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy src/ && uv run bandit -r src/ -c pyproject.toml && uv run pytest --cov=src/seerflow --cov-fail-under=95
```

If this passes, you are good to submit a PR. Each gate is described individually below, but this one-liner is the authoritative check — it is the same sequence run by the pre-push hook and the CI pipeline.

## Quality Gates

| Tool | Command | What it checks | Pass criteria |
|------|---------|----------------|---------------|
| **Ruff lint** | `uv run ruff check .` | Style violations, unused imports, undefined names, common bugs | Zero errors |
| **Ruff format** | `uv run ruff format --check .` | Code formatting consistency (line length, whitespace, string quotes) | Zero diffs |
| **mypy** | `uv run mypy src/` | Static type correctness against all annotated functions and variables | Zero type errors |
| **Bandit** | `uv run bandit -r src/ -c pyproject.toml` | Security anti-patterns (hardcoded secrets, unsafe deserialization, shell injection) | Zero HIGH or CRITICAL issues |
| **pytest** | `uv run pytest --cov=src/seerflow --cov-fail-under=95` | Unit and integration test suite with branch coverage measurement | All tests pass; coverage ≥ 95% |

You can run any gate individually while iterating on code. Run the full chain before committing.

!!! info "Pre-commit hooks"
    Hooks enforce gates automatically so quality problems are caught before they reach CI.

    **Install hooks once after cloning:**

    ```bash
    uv run pre-commit install
    uv run pre-commit install --hook-type pre-push
    ```

    **Pre-commit** (runs on every `git commit`): Ruff lint, Ruff format, mypy. Fast checks that complete in under 5 seconds on a warm cache.

    **Pre-push** (runs on every `git push`): Bandit security scan plus the full pytest suite with the 95% coverage gate. Slower — budget 30–60 seconds depending on hardware.

    To run all hooks manually without committing:

    ```bash
    uv run pre-commit run --all-files
    uv run pre-commit run --all-files --hook-stage pre-push
    ```

## Test Structure

Tests are split into two directories by scope. Unit tests verify individual functions and classes in isolation. Integration tests verify pipeline stages with real storage (SQLite in WAL mode), real Drain3 parsing, and real detector instances.

```
tests/
├── conftest.py              # Shared fixtures (sample_event, sample_alert, sqlite_backend)
├── fixtures/                # Static test data (sample log files, pre-built rule YAML)
├── unit/                    # Isolated function and class tests
│   ├── test_drain3_parser.py
│   ├── test_hst.py
│   ├── test_holt_winters.py
│   ├── test_cusum.py
│   ├── test_markov.py
│   ├── test_dspot.py
│   ├── test_sigma_engine.py
│   ├── test_entity_graph.py
│   ├── test_correlation_engine.py
│   └── test_scoring.py
└── integration/             # End-to-end pipeline tests with real storage
    ├── test_pipeline.py
    ├── test_storage_sqlite.py
    ├── test_correlation_engine.py
    └── test_alerting.py
```

### Shared Fixtures

`conftest.py` provides three fixtures available in all test files:

**`sample_event()`** — returns a minimal but valid `SeerflowEvent` with all required fields populated. Use this as the base for event-specific tests; override fields with `msgspec.structs.replace()` to create variants.

**`sample_alert()`** — returns a minimal `Alert` linked to the `sample_event`. Used in alerting, dedup, and sink tests.

**`sqlite_backend(tmp_path)`** — creates a temporary SQLite database in `tmp_path`, initialises the schema, and returns a `StorageBackend` instance. The database is automatically deleted when the test finishes. Use `tmp_path` (pytest's built-in fixture) whenever a test needs a real file — never create databases in fixed paths.

**Webhook and sink tests** use `aiohttp.test_utils.TestServer` to stand up a real HTTP server within the test process. This avoids mocking HTTP at the transport level and catches serialization bugs that mock-based approaches miss.

### Coverage Requirements

| Scope | Required coverage |
|-------|------------------|
| Overall (`src/seerflow/`) | ≥ 95% |
| Critical paths: parsers, entity resolution, correlation, ML detectors | ≥ 95% |

Coverage is measured with branch coverage enabled (`--cov-branch` is set in `pyproject.toml`). A line that is executed but whose branches are not all tested counts as partially covered. To see which branches are missing, run:

```bash
uv run pytest --cov=src/seerflow --cov-report=html
open htmlcov/index.html
```

## LANL Dataset

The [Los Alamos National Laboratory (LANL) Unified Host and Network Dataset](https://csr.lanl.gov/data/unified-host-network-dataset-2017/) is a 90-day capture of anonymized host event, authentication, process, network flow, and DNS records from a real enterprise environment. It is the standard public benchmark for host-based anomaly detection research and contains labelled red-team activity — making it suitable for end-to-end validation of Seerflow's detection pipeline.

### How to Obtain

The dataset is available free of charge from the LANL Cyber Security Research data portal. Download the unified CSV files directly from [csr.lanl.gov](https://csr.lanl.gov/data/unified-host-network-dataset-2017/). No registration is required. Files are gzip-compressed CSV; the full dataset is approximately 12 GB compressed.

### Converting to SeerflowEvent

Seerflow ships a converter script that maps LANL CSV columns to `SeerflowEvent` fields:

```bash
python scripts/lanl_converter.py \
  --input /data/lanl/auth.csv.gz \
  --output /data/lanl/converted/auth.jsonl
```

The converter handles:

- **Timestamp normalisation** — LANL uses integer seconds since epoch; the converter produces nanosecond timestamps in the `timestamp_ns` field.
- **Entity extraction** — source/destination user and host columns map to `related_users` and `related_hosts`.
- **Severity inference** — LANL auth events use a `LogonType` field; the converter maps each type to an OpenTelemetry severity level (e.g. interactive logon → INFO, service account → NOTICE, failed logon → WARNING).
- **Template assignment** — because LANL records are already structured (no free-form message), the converter synthesises a synthetic Drain3 template from the event type and sets `template_id` accordingly.

To convert all files in a directory:

```bash
for f in /data/lanl/*.csv.gz; do
    python scripts/lanl_converter.py --input "$f" --output "/data/lanl/converted/$(basename "$f" .csv.gz).jsonl"
done
```

### Importing and Running a Health Check

Once converted, import the JSONL files and verify the pipeline is processing events correctly:

```bash
seerflow import lanl_converted/*.jsonl
seerflow query health
```

`seerflow query health` reports event count, detection rate, alert count, and storage size. On the LANL dataset, expect the HST detector to fire on the known red-team activity windows documented in the dataset's companion paper. Correlation alerts should appear for lateral movement sequences during days 2–4 of the capture.

!!! tip "Start small"
    The full 90-day dataset takes several hours to import. Start with `auth.csv.gz` (day 1) to verify the pipeline end-to-end before importing the full corpus.

## Testing Custom Rules

### Sigma Rules

**1. Write the rule YAML** and save it to `rules/custom/`:

```yaml
title: My Custom Detection
status: experimental
level: medium
description: Detects a specific pattern in application logs
logsource:
    category: application
    product: my-service
detection:
    selection:
        message|contains: "suspicious pattern"
    condition: selection
tags:
    - attack.discovery
```

**2. Create a test event** that should trigger the rule. The cleanest approach is to add a fixture to your test file:

```python
import msgspec.structs

def test_custom_sigma_rule(sample_event, sigma_engine):
    # Construct an event that matches the logsource and detection condition
    event = msgspec.structs.replace(
        sample_event,
        message="application encountered suspicious pattern in request",
        source_type="my-service",
    )
    alerts = sigma_engine.evaluate(event)
    assert any(a.rule_title == "My Custom Detection" for a in alerts)
```

**3. Run only the custom rule tests** to iterate quickly:

```bash
uv run pytest tests/unit/test_sigma_engine.py -k "test_custom" -v
```

The `-k "test_custom"` selector matches any test function containing `test_custom` in its name, avoiding a full suite run during rule development. Add `-s` to see stdout output, which includes the compiled pySigma condition for debugging.

!!! warning "Validation errors at startup"
    If your rule YAML is malformed, Seerflow logs a warning and skips the rule — the rest of the engine continues. Check the Seerflow logs at startup (`log_level: DEBUG`) to surface validation errors before relying on the rule in production.

### Correlation Rules

Correlation rules are YAML files in `rules/correlation/` that define multi-event patterns — typically a sequence of event templates or Sigma matches within a time window that together signal a higher-confidence incident.

**1. Write the correlation rule** in `rules/correlation/`:

```yaml
id: custom-lateral-movement-ssh
name: Custom Lateral Movement via SSH
description: Detects a failed login followed by a successful login from the same source
window_seconds: 300
min_events: 2
sequence:
  - sigma_rule: ssh-brute-force-attempt
  - sigma_rule: successful-ssh-login
entity_join: related_ips
severity: high
```

**2. Simulate the event sequence** in your integration test. Inject events that match each step of the sequence in the correct order and within the time window:

```python
import datetime
import msgspec.structs

def test_custom_correlation_rule(sample_event, sqlite_backend, correlation_engine):
    base_ns = 1_712_664_000_000_000_000  # 2026-04-09 12:00:00 UTC

    failed_login = msgspec.structs.replace(
        sample_event,
        timestamp_ns=base_ns,
        message="Failed password for root from 10.0.0.99",
    )
    success_login = msgspec.structs.replace(
        sample_event,
        timestamp_ns=base_ns + 120_000_000_000,  # +120 seconds
        message="Accepted publickey for deploy from 10.0.0.99",
    )

    correlation_engine.process(failed_login)
    alerts = correlation_engine.process(success_login)

    assert any(a.rule_id == "custom-lateral-movement-ssh" for a in alerts)
```

**3. Run the custom correlation tests:**

```bash
uv run pytest tests/integration/test_correlation_engine.py -k "test_custom" -v
```

Integration tests use the `sqlite_backend` fixture (real SQLite, not a mock) because the correlation engine persists entity state and partial sequence matches between events. Using an in-memory store would hide bugs in the persistence layer.

---

## See Also

- [Configuration Reference](../reference/config.md) — `sigma`, `correlation`, and `storage` settings
- [Sigma Rules](../correlation/sigma.md) — full Sigma engine documentation
- [Correlation Engine](../correlation/engine.md) — sequence matching and entity joins
- [Tuning](tuning.md) — adjusting detection sensitivity and threshold parameters

**Next:** [Tuning →](tuning.md) — adjusting detector thresholds, score weights, and alert suppression.
