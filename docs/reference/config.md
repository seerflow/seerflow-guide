# Configuration Reference

## Graph & Correlation

Parameters for graph-structural anomaly detection. These control when the entity graph generates alerts based on structural patterns.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph.betweenness_threshold` | `float` | `0.3` | Alert when betweenness centrality exceeds this value. Range: 0.0-1.0. |
| `graph.betweenness_risk_multiplier` | `float` | `1.5` | Multiplied by raw betweenness for risk score, capped at 1.0. |
| `graph.fan_out_sigma` | `float` | `3.0` | Standard deviations above mean for fan-out burst detection. |
| `graph.fan_out_history_size` | `int` | `20` | Rolling window sample size for fan-out baseline calculation. |
| `graph.fan_out_min_floor` | `int` | `5` | Minimum outgoing connections before fan-out alerting triggers. |
| `graph.community_crossing_risk` | `float` | `0.6` | Fixed risk score assigned to community crossing alerts. |
| `graph.community_crossing_enabled` | `bool` | `true` | Enable or disable community crossing detection. |

!!! example "Configuration Example"
    ```yaml
    graph:
      betweenness_threshold: 0.4       # raise for environments with many bridge nodes
      fan_out_sigma: 2.5               # lower for stricter fan-out detection
      fan_out_min_floor: 10            # raise for larger networks
      community_crossing_enabled: true
    ```

For detailed explanations of each parameter, see [Algorithms & Detection](../entity-graph/algorithms.md) and [Graph-Structural Correlation](../correlation/graph-structural.md).

## Detection

Parameters for the ML anomaly detection ensemble. These control how each detector behaves, how scores are blended, and when alerts fire.

### Half-Space Trees

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hst_n_trees` | `int` | `25` | Number of half-space trees. More trees = more stable scores, more memory (~2 KB/tree). |
| `detection.hst_window_size` | `int` | `1000` | Sliding window for mass updates. Larger = slower adaptation, fewer false positives. |

### Holt-Winters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hw_seasonal_period` | `int` | `1440` | Seasonal period in 1-min buckets. 1440 = 24 hours. |
| `detection.hw_alpha` | `float` | `0.3` | Level smoothing factor (0.0–1.0). Higher = faster reaction to level changes. |
| `detection.hw_beta` | `float` | `0.1` | Trend smoothing factor (0.0–1.0). Higher = faster reaction to trend changes. |
| `detection.hw_gamma` | `float` | `0.1` | Seasonal smoothing factor (0.0–1.0). Higher = faster seasonal adaptation. |
| `detection.hw_n_std` | `float` | `3.0` | Prediction band width in standard deviations. |

### CUSUM

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.cusum_drift` | `float` | `0.5` | Allowable drift before accumulation. Higher = less sensitive to small shifts. |
| `detection.cusum_threshold` | `float` | `5.0` | Cumulative sum threshold for change-point declaration. |
| `detection.cusum_ema_alpha` | `float` | `0.1` | EMA smoothing for baseline mean/variance tracking. |
| `detection.cusum_warmup_buckets` | `int` | `30` | Minutes of warmup before scoring begins. |

### Markov Chains

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.markov_smoothing` | `float` | `1e-6` | Laplace smoothing for unseen transitions. Lower = higher scores for novel sequences. |
| `detection.markov_min_events` | `int` | `100` | Minimum events per entity before scoring begins. |
| `detection.markov_max_entities` | `int` | `1000` | LRU cap on tracked entities. Memory: ~10 KB per entity. |

### DSPOT Thresholds

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.dspot_calibration_window` | `int` | `1000` | Scores collected before GPD fitting. No anomalies during calibration. |
| `detection.dspot_risk_level` | `float` | `0.0001` | Target false positive rate (0.01%). Lower = higher threshold. |
| `detection.dspot_initial_percentile` | `int` | `98` | Percentile for initial threshold. Upper at P-th, lower at (100-P)-th. |

### Blending Weights

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.weights_content` | `float` | `0.30` | HST weight in blended score. |
| `detection.weights_volume` | `float` | `0.25` | Holt-Winters (per-source) weight in blended score. |
| `detection.weights_sequence` | `float` | `0.25` | Markov weight in blended score. |
| `detection.weights_pattern` | `float` | `0.20` | CUSUM weight in blended score. |
| `detection.weights_template_volume` | `float` | `0.15` | Per-template Holt-Winters weight in blended score. |
| `detection.weights_entity_volume` | `float` | `0.15` | Per-entity Holt-Winters weight in blended score. |

Weights don't need to sum to 1.0 — only the ratios between them matter.

### Ensemble Limits

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.max_sources` | `int` | `256` | LRU cap on per-source detector instances. |
| `detection.max_template_hw` | `int` | `500` | LRU cap on per-template Holt-Winters instances. |
| `detection.max_entity_hw` | `int` | `500` | LRU cap on per-entity Holt-Winters instances. |
| `detection.model_save_interval_seconds` | `int` | `300` | Checkpoint interval in seconds. |
| `detection.score_interval` | `int` | `1` | Score every N-th event per source. Set > 1 to reduce CPU. |
| `detection.min_events_for_scoring` | `int` | `50` | Events before ensemble starts scoring a new source. |

!!! example "Configuration Example"
    ```yaml
    detection:
      hst_window_size: 2000       # larger window for noisy environments
      hw_n_std: 4.0               # wider prediction band, fewer false positives
      cusum_drift: 0.3            # more sensitive to small shifts
      dspot_risk_level: 0.001     # lower threshold, more alerts
      weights_content: 0.35       # emphasize content novelty
      max_sources: 512            # more sources before eviction
    ```

For detailed explanations of each parameter and tuning advice, see the individual detector pages: [HST](../detection/hst.md), [Holt-Winters](../detection/holt-winters.md), [CUSUM](../detection/cusum.md), [Markov](../detection/markov.md), [DSPOT](../detection/dspot.md), [Scoring](../detection/scoring.md).

## Alerting

Parameters for alert deduplication, delivery targets, and export integrations.

### Deduplication

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.dedup_window_seconds` | `int` | `900` | Global deduplication window in seconds (15 minutes). Identical alerts within this window are suppressed. |
| `alerting.dedup_window_overrides` | `dict` | `{}` | Per-rule deduplication windows. Keys are rule IDs, values are seconds. Overrides `dedup_window_seconds` for matching rules. |
| `alerting.dashboard_url` | `str` | `""` | Base URL of the Seerflow dashboard. Included in alert payloads as a deep-link. Must use `http` or `https`. |

### Webhooks

Each entry in `alerting.webhooks` is an outbound delivery target.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.webhooks[*].url` | `str` | required | Destination URL. Must use `http` or `https` and must not target a private or reserved IP. |
| `alerting.webhooks[*].format` | `str` | required | Payload format. One of `slack`, `teams`, or `json`. |
| `alerting.webhooks[*].min_severity` | `int` | `0` | Only deliver alerts with `severity >= min_severity`. `0` delivers all alerts. |

### PagerDuty

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.pagerduty_routing_key` | `str` | `""` | PagerDuty Events API v2 routing key. Must be a 32-character hexadecimal string. Leave empty to disable PagerDuty delivery. |

### OTLP

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.otlp_endpoint` | `str` | `""` | OTLP collector endpoint. Leave empty to disable OTLP export. Example: `http://otel-collector:4317`. |
| `alerting.otlp_protocol` | `str` | `"grpc"` | Transport protocol for OTLP export. One of `grpc` or `http`. |
| `alerting.otlp_export_interval_seconds` | `int` | `5` | How often the OTLP sink flushes its batch queue, in seconds. Must be >= 1. |

!!! example "Alerting Configuration Example"
    ```yaml
    alerting:
      dedup_window_seconds: 600         # 10-minute dedup window
      dedup_window_overrides:
        brute-force-login: 300          # 5-minute window for high-frequency rule
        lateral-movement: 1800          # 30-minute window for slow-burn rule
      dashboard_url: https://seerflow.example.com

      webhooks:
        - url: https://hooks.slack.com/services/T000/B000/xxxx
          format: slack
          min_severity: 3              # only high/critical alerts
        - url: https://seerflow.example.com/webhook/alerts
          format: json
          min_severity: 0              # all alerts

      pagerduty_routing_key: ${PD_ROUTING_KEY}   # 32-char hex from PagerDuty

      otlp_endpoint: http://otel-collector:4317
      otlp_protocol: grpc
      otlp_export_interval_seconds: 10
    ```

For detailed explanations, see [Alerting & Feedback](../operations/alerting.md).

## Storage

Parameters for the storage backend used to persist events, alerts, and ML model state.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `storage.backend` | `str` | `"sqlite"` | Storage backend to use. One of `sqlite` or `postgresql`. |
| `storage.data_dir` | `str` | `~/.local/share/seerflow` | Base directory for all data files. Respects `$XDG_DATA_HOME`. Can also be set via `$SEERFLOW_DATA_DIR`. |
| `storage.sqlite_path` | `str` | `{data_dir}/seerflow.db` | Absolute path to the SQLite database file. Defaults to `seerflow.db` inside `data_dir`. |
| `storage.postgresql_url` | `str` | `""` | PostgreSQL connection URL. Required when `backend` is `postgresql`. Example: `postgresql+asyncpg://user:pass@host/db`. |

!!! example "Storage Configuration Example"
    ```yaml
    storage:
      backend: postgresql
      postgresql_url: ${DATABASE_URL}   # set via environment variable
    ```

    For SQLite (default, zero-config):

    ```yaml
    storage:
      data_dir: /var/lib/seerflow       # override default XDG path
    ```

For detailed explanations, see [Storage Backends](../operations/storage.md).

## Correlation

Parameters for the temporal correlation engine that joins events across entities within a sliding window.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `correlation.window_duration_seconds` | `int` | `1800` | Duration of the sliding correlation window in seconds (30 minutes). Events outside this window are not correlated. |
| `correlation.max_events_per_entity` | `int` | `1000` | Maximum events buffered per entity within the correlation window. Older events are evicted when the limit is reached. |
| `correlation.max_entities` | `int` | `10000` | Maximum number of entities tracked simultaneously. LRU eviction applies. |
| `correlation.late_tolerance_seconds` | `int` | `30` | Grace period for late-arriving events, in seconds. Events arriving up to this many seconds past the window boundary are still accepted. |
| `correlation.rule_dirs` | `list[str]` | `[]` | Directories containing YAML correlation rule files. Directories are scanned at startup; rules are hot-reloadable. |

!!! example "Correlation Configuration Example"
    ```yaml
    correlation:
      window_duration_seconds: 3600     # 1-hour correlation window
      max_events_per_entity: 2000
      max_entities: 50000
      late_tolerance_seconds: 60
      rule_dirs:
        - /etc/seerflow/rules/correlation
        - /opt/custom/correlation-rules
    ```

For detailed explanations, see [Correlation Engine](../correlation/engine.md).

## Pipeline

Top-level pipeline settings, split into receiver configuration and general runtime options.

### Receivers

Parameters under `receivers:` control which log ingestion sources are active and how they are configured.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `receivers.syslog_enabled` | `bool` | `true` | Enable the syslog receiver (UDP and optionally TCP). |
| `receivers.syslog_udp_port` | `int` | `514` | UDP port for syslog ingestion. |
| `receivers.syslog_tcp_port` | `int` | `601` | TCP port for syslog ingestion. |
| `receivers.syslog_tcp_enabled` | `bool` | `true` | Enable TCP transport for syslog (in addition to UDP). |
| `receivers.otlp_grpc_enabled` | `bool` | `true` | Enable the OTLP gRPC receiver. |
| `receivers.otlp_grpc_port` | `int` | `4317` | Port for the OTLP gRPC endpoint. |
| `receivers.otlp_http_enabled` | `bool` | `true` | Enable the OTLP HTTP/Protobuf receiver. |
| `receivers.otlp_http_port` | `int` | `4318` | Port for the OTLP HTTP endpoint. |
| `receivers.file_paths` | `list[str]` | `[]` | Absolute paths to log files to tail. Supports glob patterns. |
| `receivers.bind_addr` | `str` | `"0.0.0.0"` | IP address to bind all receivers to. |
| `receivers.queue_maxsize` | `int` | `10000` | Internal event queue capacity. When full, new events are dropped. Range: 1–1,000,000. |
| `receivers.webhook_enabled` | `bool` | `false` | Enable the inbound webhook receiver (HTTP push from external systems). |
| `receivers.webhook_port` | `int` | `8081` | Port for the inbound webhook receiver. |

### General

Top-level keys (not nested under any section):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dashboard_port` | `int` | `8080` | Port for the built-in dashboard HTTP server. Must be a valid port (1–65535). |
| `health_bind_address` | `str` | `"127.0.0.1"` | IP address to bind the health-check endpoint. Must be a valid IP address. Defaults to loopback. |
| `log_level` | `str` | `"INFO"` | Seerflow process log level. One of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |

!!! example "Pipeline Configuration Example"
    ```yaml
    receivers:
      syslog_enabled: true
      syslog_udp_port: 514
      syslog_tcp_enabled: true
      syslog_tcp_port: 601
      otlp_grpc_enabled: true
      otlp_grpc_port: 4317
      otlp_http_enabled: false          # disable HTTP if only gRPC is needed
      file_paths:
        - /var/log/app/*.log
        - /var/log/nginx/access.log
      bind_addr: "0.0.0.0"
      queue_maxsize: 50000
      webhook_enabled: true
      webhook_port: 8081

    dashboard_port: 8080
    health_bind_address: "127.0.0.1"
    log_level: INFO
    ```

For detailed explanations, see [Architecture: Pipeline](../architecture/pipeline.md).

## Environment Variables

All string values in `seerflow.yaml` support environment variable interpolation using `${VAR}` and `${VAR:-default}` syntax. Interpolation happens at load time before any validation.

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Substitutes the value of `VAR`. Raises `ConfigError` at startup if `VAR` is not set. |
| `${VAR:-default}` | Substitutes the value of `VAR` if set; falls back to `default` if not. |

!!! example "Common Environment Variable Patterns"
    ```yaml
    storage:
      postgresql_url: ${DATABASE_URL}                        # required — fails fast if unset

    alerting:
      pagerduty_routing_key: ${PD_ROUTING_KEY:-}             # optional — empty string if unset
      dashboard_url: ${SEERFLOW_DASHBOARD_URL:-http://localhost:8080}

    receivers:
      bind_addr: ${BIND_ADDR:-0.0.0.0}
    ```

    Interpolation works in any string field, including nested structures like webhook URLs:

    ```yaml
    alerting:
      webhooks:
        - url: ${SLACK_WEBHOOK_URL}
          format: slack
          min_severity: 3
    ```

## Configuration Examples

### Minimal Configuration

The smallest viable `seerflow.yaml`. All other parameters use built-in defaults.

```yaml
storage:
  data_dir: /var/lib/seerflow

receivers:
  syslog_enabled: true
  otlp_grpc_enabled: true
  otlp_http_enabled: false
```

With this configuration, Seerflow starts with:

- SQLite storage at `/var/lib/seerflow/seerflow.db`
- Syslog receiver on UDP 514 and TCP 601
- OTLP gRPC receiver on port 4317
- All ML detectors at their default sensitivity
- No alerting sinks (alerts are logged locally only)

### Full Configuration

Annotated example showing all sections with commonly-tuned values.

```yaml
# Runtime
log_level: INFO
dashboard_port: 8080
health_bind_address: "127.0.0.1"

# Storage
storage:
  backend: postgresql
  postgresql_url: ${DATABASE_URL}
  data_dir: /var/lib/seerflow

# Log receivers
receivers:
  syslog_enabled: true
  syslog_udp_port: 514
  syslog_tcp_port: 601
  syslog_tcp_enabled: true
  otlp_grpc_enabled: true
  otlp_grpc_port: 4317
  otlp_http_enabled: true
  otlp_http_port: 4318
  file_paths:
    - /var/log/app/*.log
  bind_addr: "0.0.0.0"
  queue_maxsize: 50000
  webhook_enabled: false

# ML detection ensemble
detection:
  hst_window_size: 2000
  hw_n_std: 3.5
  cusum_drift: 0.4
  dspot_risk_level: 0.0001
  weights_content: 0.30
  weights_volume: 0.25
  weights_sequence: 0.25
  weights_pattern: 0.20
  max_sources: 512
  model_save_interval_seconds: 300

# Temporal correlation
correlation:
  window_duration_seconds: 1800
  max_events_per_entity: 1000
  max_entities: 10000
  late_tolerance_seconds: 30
  rule_dirs:
    - /etc/seerflow/rules/correlation

# Alerting
alerting:
  dedup_window_seconds: 900
  dedup_window_overrides:
    brute-force-login: 300
  dashboard_url: ${SEERFLOW_DASHBOARD_URL:-}

  webhooks:
    - url: ${SLACK_WEBHOOK_URL}
      format: slack
      min_severity: 3
    - url: ${TEAMS_WEBHOOK_URL}
      format: teams
      min_severity: 5

  pagerduty_routing_key: ${PD_ROUTING_KEY:-}

  otlp_endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:-}
  otlp_protocol: grpc
  otlp_export_interval_seconds: 5

# Graph-structural detection (nested under detection)
detection:
  graph_structural:
    betweenness_threshold: 0.3
    fan_out_sigma: 3.0
    fan_out_min_floor: 5
    community_crossing_enabled: true
```
