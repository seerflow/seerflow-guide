# Configuration Reference

Seerflow is configured via a single YAML file (`seerflow.yaml`). Every
public configuration knob is documented here. Values not specified fall
back to the defaults listed in each table.

Top-level sections:

| Section | Purpose |
|---------|---------|
| [`storage`](#storage) | Event / alert / model state persistence, graph backend |
| [`receivers`](#receivers) | Log ingestion sources |
| [`detection`](#detection) | ML detection ensemble + graph-structural + kill-chain + risk |
| [`correlation`](#correlation) | Temporal correlation window |
| [`alerting`](#alerting) | Multi-channel delivery, routing, dedup |
| [`llm`](#llm) | Local / cloud LLM backend for hunt, explanation, rule suggestion |
| [`ueba`](#ueba) | Per-entity behavioural baselines and scoring |
| [`threat_intel`](#threat-intel) | STIX/TAXII feeds + IoC matcher |
| Top-level WS / API / runtime knobs | [WebSocket](#websocket), [API](#api), [runtime](#runtime) |

`${ENV_VAR}` / `${ENV_VAR:-default}` interpolation is supported in every
string value — see [Environment Variables](#environment-variables).

---

## Storage

Backend selection and connection knobs for the event/alert store and
the entity graph.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `storage.backend` | `str` | `"sqlite"` | Event/alert backend. One of `sqlite`, `postgresql`. |
| `storage.data_dir` | `str` | `~/.local/share/seerflow` | Base directory for all data files. Respects `$XDG_DATA_HOME`. Can also be set via `$SEERFLOW_DATA_DIR`. |
| `storage.sqlite_path` | `str` | `{data_dir}/seerflow.db` | Absolute path to the SQLite database file. Defaults to `seerflow.db` inside `data_dir`. |
| `storage.postgresql_url` | `str` | `""` | PostgreSQL connection URL. Required when `backend == "postgresql"`. Example: `postgresql://user:pass@host/db`. Credentials are redacted from logs and `repr`. |
| `storage.postgresql_pool_min_size` | `int` | `2` | asyncpg pool minimum size. |
| `storage.postgresql_pool_max_size` | `int` | `10` | asyncpg pool maximum size. |
| `storage.postgresql_command_timeout_s` | `float` | `30.0` | Per-statement timeout, in seconds. |
| `storage.graph_backend` | `str` | `"igraph"` | Entity-graph backend. One of `igraph` (in-process), `falkordb` (Redis-based), `postgres_age` (PostgreSQL AGE). |
| `storage.falkordb_url` | `str` | `""` | FalkorDB connection URL — required when `graph_backend == "falkordb"`. Credentials redacted from `repr`. |

!!! example "Storage Configuration Example"
    ```yaml
    storage:
      backend: postgresql
      postgresql_url: ${DATABASE_URL}
      postgresql_pool_min_size: 4
      postgresql_pool_max_size: 32
      postgresql_command_timeout_s: 15.0

      graph_backend: falkordb
      falkordb_url: ${FALKORDB_URL:-redis://localhost:6379/0}
    ```

    SQLite + in-process igraph (zero-config default):

    ```yaml
    storage:
      data_dir: /var/lib/seerflow
    ```

See [Storage Backends](../operations/storage.md) and
[Graph Backends](../entity-graph/backends.md) for trade-offs and
operational guidance.

---

## Receivers

Log ingestion sources. Every receiver can be enabled/disabled
independently.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `receivers.syslog_enabled` | `bool` | `true` | Enable the syslog UDP receiver. |
| `receivers.syslog_udp_port` | `int` | `514` | UDP port for syslog ingestion. |
| `receivers.syslog_tcp_enabled` | `bool` | `true` | Enable TCP transport for syslog. |
| `receivers.syslog_tcp_port` | `int` | `601` | TCP port for syslog ingestion. |
| `receivers.otlp_grpc_enabled` | `bool` | `true` | Enable the OTLP gRPC receiver. |
| `receivers.otlp_grpc_port` | `int` | `4317` | Port for the OTLP gRPC endpoint. |
| `receivers.otlp_grpc_max_workers` | `int` | `4` | Thread-pool size for the gRPC server. |
| `receivers.otlp_http_enabled` | `bool` | `true` | Enable the OTLP HTTP/Protobuf receiver. |
| `receivers.otlp_http_port` | `int` | `4318` | Port for the OTLP HTTP endpoint. |
| `receivers.otlp_http_max_request_bytes` | `int` | `4194304` | Maximum request size (bytes). Defaults to 4 MiB. |
| `receivers.file_paths` | `list[str]` | `[]` | Absolute paths to log files to tail. Supports glob patterns. |
| `receivers.file_checkpoint_dir` | `str` | `""` | Directory for file-tail checkpoints. Required for crash-safe resume; empty disables checkpointing. |
| `receivers.file_debounce_ms` | `int` | `1600` | Debounce window (ms) for file-watcher events, to coalesce log rotations. |
| `receivers.allowed_log_roots` | `list[str]` | `[]` | Allowlist of directories under which `file_paths` and `seerflow import` may read. Empty = unrestricted. |
| `receivers.webhook_enabled` | `bool` | `false` | Enable the inbound webhook receiver. |
| `receivers.webhook_port` | `int` | `8081` | Port for the inbound webhook receiver. |
| `receivers.webhooks` | `list[obj]` | `[]` | Individual webhook endpoint configs (see below). |
| `receivers.bind_addr` | `str` | `"0.0.0.0"` | IP address to bind all receivers to. |
| `receivers.queue_maxsize` | `int` | `10000` | Internal event queue capacity (1–1,000,000). Backpressure drops new events when full. |

### Webhook endpoint shape

Each entry in `receivers.webhooks`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `str` | `/ingest/webhook` | HTTP path served by the webhook receiver. |
| `auth_header` | `str` | `""` | Header name carrying the shared secret (e.g. `X-Webhook-Token`). Must be paired with `auth_token`. |
| `auth_token` | `str` | `""` | Shared secret value. Pair with `auth_header`; redacted from `repr`. |
| `source_id` | `str` | `webhook` | Source-type tag attached to ingested events. |
| `field_mapping` | `dict[str,str]` | `{}` | JSON-key → Seerflow-field mapping. |

!!! example "Receivers Configuration Example"
    ```yaml
    receivers:
      syslog_enabled: true
      otlp_grpc_enabled: true
      otlp_grpc_max_workers: 8
      otlp_http_enabled: true
      otlp_http_max_request_bytes: 8388608      # 8 MiB
      file_paths:
        - /var/log/app/*.log
      file_checkpoint_dir: /var/lib/seerflow/checkpoints
      allowed_log_roots:
        - /var/log
      bind_addr: "0.0.0.0"
      queue_maxsize: 50000
      webhook_enabled: true
      webhook_port: 8081
      webhooks:
        - path: /ingest/datadog
          auth_header: X-Webhook-Token
          auth_token: ${DATADOG_WEBHOOK_TOKEN}
          source_id: datadog
    ```

---

## Detection

ML ensemble plus graph-structural correlation, kill-chain, and entity
risk scoring.

### Half-Space Trees

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hst_n_trees` | `int` | `25` | Number of half-space trees. More trees = more stable scores, more memory (~2 KB/tree). |
| `detection.hst_window_size` | `int` | `1000` | Sliding window for mass updates. Larger = slower adaptation, fewer false positives. |

### Holt-Winters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.hw_seasonal_period` | `int` | `1440` | Seasonal period in 1-min buckets. 1440 = 24 hours. |
| `detection.hw_alpha` | `float` | `0.3` | Level smoothing factor (0.0–1.0). |
| `detection.hw_beta` | `float` | `0.1` | Trend smoothing factor (0.0–1.0). |
| `detection.hw_gamma` | `float` | `0.1` | Seasonal smoothing factor (0.0–1.0). |
| `detection.hw_n_std` | `float` | `3.0` | Prediction band width in standard deviations. |

### CUSUM

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.cusum_drift` | `float` | `0.5` | Allowable drift before accumulation. |
| `detection.cusum_threshold` | `float` | `5.0` | Cumulative sum threshold for change-point declaration. |
| `detection.cusum_ema_alpha` | `float` | `0.1` | EMA smoothing for baseline mean/variance tracking. |
| `detection.cusum_warmup_buckets` | `int` | `30` | Minutes of warmup before scoring begins. |

### Markov Chains

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.markov_smoothing` | `float` | `1e-6` | Laplace smoothing for unseen transitions. |
| `detection.markov_min_events` | `int` | `100` | Minimum events per entity before scoring begins. |
| `detection.markov_max_entities` | `int` | `1000` | LRU cap on tracked entities. ~10 KB per entity. |

### DSPOT Thresholds

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.dspot_calibration_window` | `int` | `1000` | Scores collected before GPD fitting. No alerts during calibration. |
| `detection.dspot_risk_level` | `float` | `0.0001` | Target false-positive rate (0.01%). Lower = higher threshold. |
| `detection.dspot_initial_percentile` | `int` | `98` | Percentile for initial threshold. |
| `detection.dspot_threshold_cap_multiplier` | `float` | `5.0` | Maximum factor by which feedback may raise the DSPOT threshold over the calibrated baseline. |

### Blending Weights

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.weights_content` | `float` | `0.30` | HST weight in the blended score. |
| `detection.weights_volume` | `float` | `0.25` | Holt-Winters (per-source) weight. |
| `detection.weights_sequence` | `float` | `0.25` | Markov weight. |
| `detection.weights_pattern` | `float` | `0.20` | CUSUM weight. |
| `detection.weights_template_volume` | `float` | `0.15` | Per-template Holt-Winters weight. |
| `detection.weights_entity_volume` | `float` | `0.15` | Per-entity Holt-Winters weight. |

Weights don't need to sum to 1.0 — only the ratios matter.

### Ensemble Limits

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.max_sources` | `int` | `256` | LRU cap on per-source detector instances. |
| `detection.max_template_hw` | `int` | `500` | LRU cap on per-template Holt-Winters instances. |
| `detection.max_entity_hw` | `int` | `500` | LRU cap on per-entity Holt-Winters instances. |
| `detection.model_save_interval_seconds` | `int` | `300` | Checkpoint interval in seconds. |
| `detection.score_interval` | `int` | `1` | Score every N-th event per source. |
| `detection.min_events_for_scoring` | `int` | `50` | Events before ensemble starts scoring a new source. |

### Risk & Graph Algorithms

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.graph_algo_interval` | `int` | `500` | Run entity-graph algorithms (PageRank, betweenness, communities) every N events. |
| `detection.risk_half_life_hours` | `int` | `4` | Time for an entity's accumulated risk score to halve. |
| `detection.risk_threshold` | `float` | `50.0` | Alert when an entity's risk score crosses this value. |
| `detection.risk_max_entities` | `int` | `10000` | LRU cap on entities tracked for risk accumulation. |

### Sigma & ATT&CK

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.sigma_rules_dirs` | `list[str]` | `[]` | Directories scanned for Sigma rules at startup. |
| `detection.sigma_custom_upload_dir` | `str?` | `null` | Directory where the dashboard upload UI persists custom Sigma rules. Always discovered at startup. |
| `detection.attack_mappings` | `list[obj]` | `[]` | Custom ATT&CK tactic/technique mappings overlaid on bundled mappings. |

### Graph-Structural

Nested under `detection.graph_structural`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.graph_structural.betweenness_threshold` | `float` | `0.3` | Alert when betweenness centrality exceeds this value. |
| `detection.graph_structural.fan_out_sigma` | `float` | `3.0` | Standard deviations above mean for fan-out burst detection. |
| `detection.graph_structural.fan_out_history_size` | `int` | `20` | Rolling window for fan-out baseline. |
| `detection.graph_structural.fan_out_min_floor` | `int` | `5` | Minimum outgoing connections before fan-out alerting triggers. |
| `detection.graph_structural.community_crossing_enabled` | `bool` | `true` | Enable/disable community crossing detection. |

### Kill Chain

Nested under `detection.kill_chain`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detection.kill_chain.enabled` | `bool` | `true` | Feature flag for tactic-progression detection. |
| `detection.kill_chain.tactic_threshold` | `int` | `3` | Minimum distinct ATT&CK tactics within the window to fire an alert. |
| `detection.kill_chain.window_seconds` | `int` | `86400` | Observation window. Default 24 h. |
| `detection.kill_chain.max_entities` | `int` | `10000` | LRU cap on entities tracked for kill-chain assembly. |

For tuning advice see the individual detector pages
([HST](../detection/hst.md), [Holt-Winters](../detection/holt-winters.md),
[CUSUM](../detection/cusum.md), [Markov](../detection/markov.md),
[DSPOT](../detection/dspot.md), [Scoring](../detection/scoring.md))
and [Kill Chain](../correlation/kill-chain.md).

---

## Correlation

Temporal correlation engine joining events across entities within a
sliding window.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `correlation.window_duration_seconds` | `int` | `1800` | Sliding window duration. Events outside are not correlated. |
| `correlation.max_events_per_entity` | `int` | `1000` | Maximum events buffered per entity within the window. |
| `correlation.max_entities` | `int` | `10000` | Maximum entities tracked simultaneously. LRU. |
| `correlation.late_tolerance_seconds` | `int` | `30` | Grace period for late-arriving events. |
| `correlation.rule_dirs` | `list[str]` | `[]` | Directories containing YAML correlation rules. Scanned at startup. |

See [Correlation Engine](../correlation/engine.md).

---

## Alerting

Multi-channel alert delivery (Slack/Teams/JSON webhooks, PagerDuty,
OTLP, email, SMS, Telegram, WhatsApp), per-rule deduplication,
routing rules, and quiet hours.

### Deduplication

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.dedup_window_seconds` | `int` | `900` | Global dedup window (15 min). |
| `alerting.dedup_window_overrides` | `dict` | `{}` | Per-rule dedup windows in seconds. |
| `alerting.dashboard_url` | `str` | `""` | Base URL of the dashboard, included in alert payloads. Must be `http`/`https`. |

### Webhooks (Slack / Teams / JSON)

Outbound delivery targets, listed under `alerting.webhooks`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | `str` | required | Destination URL. Must not target private/reserved IPs. |
| `format` | `str` | required | `slack`, `teams`, or `json`. |
| `min_severity` | `int` | `0` | Deliver only when `severity >= min_severity`. |

### PagerDuty

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.pagerduty_routing_key` | `str` | `""` | Events API v2 routing key (32-char hex). Empty disables PagerDuty. |

### OTLP

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `alerting.otlp_endpoint` | `str` | `""` | OTLP collector endpoint (e.g. `https://otel-collector:4317`). |
| `alerting.otlp_protocol` | `str` | `"grpc"` | `grpc` or `http`. |
| `alerting.otlp_export_interval_seconds` | `int` | `5` | Flush interval in seconds. |
| `alerting.otlp_tls` | `bool?` | `null` | `null` = auto (grpc → TLS, http → URL scheme). Set explicitly to override. |
| `alerting.otlp_tls_ca_file` | `str` | `""` | Custom CA bundle PEM path. Empty = use Mozilla roots. |
| `alerting.otlp_mtls_cert_file` | `str` | `""` | Client certificate PEM path (mutual TLS). |
| `alerting.otlp_mtls_key_file` | `str` | `""` | Client private key PEM path (mutual TLS). |

Rotation of CA / cert / key requires a process restart.

### Email targets (`alerting.email_targets`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `str` | required | Unique name (used by routing rules). |
| `smtp_host` | `str` | required | SMTP server hostname. Must not be a private address. |
| `smtp_port` | `int` | required | SMTP port (1–65535). |
| `use_starttls` | `bool` | required | Whether to upgrade to STARTTLS. |
| `from_address` | `str` | required | Envelope From. |
| `to_addresses` | `list[str]` | required | Recipient list (non-empty). |
| `smtp_user` | `str` | `""` | SMTP username. |
| `smtp_password` | `str` | `""` | SMTP password (redacted in `repr`). |
| `min_severity` | `int` | `0` | Filter by severity. |
| `max_per_minute` | `int?` | `null` | Optional rate cap. |

### SMS targets (`alerting.sms_targets`)

Twilio-backed.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `str` | required | Unique target name. |
| `provider` | `str` | required | Only `twilio` is supported. |
| `account_sid` | `str` | required | Twilio Account SID. |
| `from_number` | `str` | required | Sender phone number. |
| `to_numbers` | `list[str]` | required | Recipient phone numbers (non-empty). |
| `auth_token` | `str` | required | Twilio auth token (redacted). |
| `min_severity` | `int` | `0` | Severity floor. |
| `rate_per_second` | `float` | `1.0` | Token-bucket refill rate. |
| `burst` | `int` | `3` | Token-bucket capacity. |

### Telegram targets (`alerting.telegram_targets`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `str` | required | Unique target name. |
| `bot_token` | `str` | required | Telegram bot token (redacted). |
| `chat_id` | `str` | required | Target chat ID. |
| `min_severity` | `int` | `0` | Severity floor. |
| `rate_per_second` | `float` | `30.0` | Token-bucket refill. |
| `burst` | `int` | `30` | Token-bucket capacity. |

### WhatsApp targets (`alerting.whatsapp_targets`)

WhatsApp Cloud API.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `str` | required | Unique target name. |
| `phone_number_id` | `str` | required | Meta-side phone number ID. |
| `template_name` | `str` | required | Pre-approved template name. |
| `language_code` | `str` | required | Template language. |
| `to_numbers` | `list[str]` | required | Recipient numbers (E.164). |
| `access_token` | `str` | required | Meta access token (redacted). |
| `min_severity` | `int` | `0` | Severity floor. |
| `rate_per_second` | `float` | `10.0` | Token-bucket refill. |
| `burst` | `int` | `20` | Token-bucket capacity. |

### Routing rules (`alerting.routing_rules`)

First-match-wins. Each rule has a `match` predicate (AND across fields)
and a `notify` list of channels.

| `match.*` field | Type | Default | Description |
|-----------------|------|---------|-------------|
| `alert_type` | `str` or `list[str]` | — | One or more alert types (`ml`, `sigma`, `correlation`, `ueba`, `ioc`). |
| `rule_name` | `str` (glob) | — | `fnmatch.fnmatchcase` glob on `rule_name`. |
| `entity_type` | `str` or `list[str]` | — | One or more entity types (`user`, `ip`, `host`, …). |
| `min_severity` | `int` | — | Inclusive lower severity bound (0–6). |
| `max_severity` | `int` | — | Inclusive upper severity bound (0–6). |

| `notify[*]` field | Type | Default | Description |
|-------------------|------|---------|-------------|
| `channel` | `str` | required | Name of a target defined elsewhere in `alerting`. |
| `mode` | `str` | `"immediate"` | `immediate` or `digest`. |
| `digest_window_minutes` | `int` | `15` | Digest flush interval (1–1440). Ignored when `mode == immediate`. |

| `alerting.default_routing` field | Type | Default | Description |
|----------------------------------|------|---------|-------------|
| `action` | `str` | `"drop"` | `drop` or `notify`. |
| `notify` | `list[notify]` | `[]` | Required when `action == notify`. |

`default_routing` may only be set when `routing_rules` is non-empty.

### Quiet hours (`alerting.quiet_hours_by_channel`)

Map of channel-name → quiet-hours block. UTC times.

| Field | Type | Description |
|-------|------|-------------|
| `start` | `HH:MM` | Inclusive window start. |
| `end` | `HH:MM` | Exclusive window end. Wraps midnight when `start > end`. |
| `min_severity` | `int` | Alerts with `severity_id < min_severity` are dropped while inside the window. |

!!! example "Alerting Configuration Example"
    ```yaml
    alerting:
      dedup_window_seconds: 600
      dedup_window_overrides:
        brute-force-login: 300
      dashboard_url: ${SEERFLOW_DASHBOARD_URL}

      webhooks:
        - url: ${SLACK_WEBHOOK_URL}
          format: slack
          min_severity: 3

      pagerduty_routing_key: ${PD_ROUTING_KEY}

      otlp_endpoint: https://otel-collector.internal:4317
      otlp_protocol: grpc
      otlp_tls: true
      otlp_tls_ca_file: /etc/seerflow/tls/internal-ca.pem
      otlp_mtls_cert_file: /etc/seerflow/tls/seerflow.crt
      otlp_mtls_key_file: /etc/seerflow/tls/seerflow.key

      email_targets:
        - name: ops-email
          smtp_host: smtp.example.com
          smtp_port: 587
          use_starttls: true
          from_address: alerts@example.com
          to_addresses: [oncall@example.com]
          smtp_user: alerts
          smtp_password: ${SMTP_PASSWORD}
          max_per_minute: 30

      sms_targets:
        - name: ops-sms
          provider: twilio
          account_sid: ${TWILIO_SID}
          auth_token:  ${TWILIO_TOKEN}
          from_number: "+15555550100"
          to_numbers: ["+15555550111"]
          rate_per_second: 1.0
          burst: 3

      telegram_targets:
        - name: ops-telegram
          bot_token: ${TELEGRAM_BOT_TOKEN}
          chat_id: ${TELEGRAM_CHAT_ID}
          min_severity: 2

      whatsapp_targets:
        - name: ops-whatsapp
          phone_number_id: "123456789"
          template_name: seerflow_alert_v1
          language_code: en_US
          to_numbers: ["+15555550111"]
          access_token: ${WHATSAPP_ACCESS_TOKEN}

      routing_rules:
        - match:
            alert_type: [sigma, correlation]
            min_severity: 5
          notify:
            - { channel: ops-sms, mode: immediate }
            - { channel: ops-email, mode: immediate }
        - match:
            alert_type: ml
            min_severity: 3
          notify:
            - { channel: ops-telegram, mode: digest, digest_window_minutes: 15 }

      default_routing:
        action: notify
        notify:
          - { channel: ops-email, mode: digest, digest_window_minutes: 60 }

      quiet_hours_by_channel:
        ops-sms:
          start: "22:00"
          end:   "07:00"
          min_severity: 5
    ```

See [Alerting & Feedback](../operations/alerting.md).

---

## LLM

Pluggable LLM backend used by three services: natural-language hunt,
alert explanations, and Sigma rule suggestions.

`backend` selects the concrete implementation:

- `""` — LLM features disabled (default).
- `"llama_cpp"` — local CPU inference via `llama-cpp-python`.
- `"ollama"` — HTTP backend (e.g. local Ollama daemon).
- `"cloud"` — Anthropic / OpenAI SDK backend.

### Backend selection

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm.backend` | `str` | `""` | One of the values above. |
| `llm.model_path` | `str` | `""` | Local model path (`llama_cpp` only). |
| `llm.ollama_url` | `str` | `http://localhost:11434` | Ollama base URL. |
| `llm.ollama_model` | `str` | `phi4-mini` | Ollama model name. |
| `llm.ollama_timeout_s` | `float` | `30.0` | Per-request timeout. |
| `llm.cloud_provider` | `str` | `""` | `anthropic` or `openai`. |
| `llm.cloud_api_key` | `str` | `""` | Provider API key. Redacted from `repr`. |
| `llm.cloud_model` | `str` | `""` | Model name (e.g. `claude-haiku-4-5-20251001`). |
| `llm.cloud_base_url` | `str` | `""` | Optional override URL. |
| `llm.cloud_timeout_s` | `float` | `30.0` | Per-request timeout. |

### llama.cpp tuning

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm.n_ctx` | `int` | `4096` | Context window size. |
| `llm.n_threads` | `int?` | `null` | CPU threads. `null` → llama.cpp default. |
| `llm.n_gpu_layers` | `int` | `0` | Layers offloaded to GPU. |
| `llm.max_tokens_default` | `int` | `256` | Default max tokens per call. |
| `llm.temperature_default` | `float` | `0.2` | Default sampling temperature. |
| `llm.seed` | `int` | `42` | Sampling seed for reproducibility. |

### Alert explanation

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm.explanation_cache_size` | `int` | `256` | LRU cap on cached explanations. |
| `llm.explanation_cache_ttl_s` | `int` | `3600` | TTL (s). |
| `llm.explanation_max_contributing_events` | `int` | `8` | Events included in the prompt. |
| `llm.explanation_max_prompt_chars` | `int` | `8000` | Hard prompt size cap. |
| `llm.explanation_timeout_s` | `float` | `12.0` | Per-call timeout. |

### Hunt (NL → query)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm.hunt_cache_size` | `int` | `256` | LRU cap. |
| `llm.hunt_cache_ttl_s` | `int` | `3600` | TTL (s). |
| `llm.hunt_timeout_s` | `float` | `12.0` | Per-call timeout. |
| `llm.hunt_max_results` | `int` | `100` | Default `--limit` for `seerflow hunt`. |
| `llm.hunt_max_query_chars` | `int` | `512` | Maximum prompt length. |

### Rule suggestion

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `llm.rule_suggestion_cache_size` | `int` | `64` | LRU cap. |
| `llm.rule_suggestion_cache_ttl_s` | `int` | `21600` | TTL (s). Default 6 h. |
| `llm.rule_suggestion_min_tp` | `int` | `3` | Minimum true-positive feedbacks required to seed a draft. |
| `llm.rule_suggestion_window_days` | `int` | `0` | Look-back window. `0` = all time. |
| `llm.rule_suggestion_timeout_s` | `float` | `30.0` | Per-call timeout (higher than explanation because output is structured YAML). |

!!! example "LLM Configuration Example"
    ```yaml
    llm:
      backend: ollama
      ollama_url: http://ollama:11434
      ollama_model: phi4-mini

      explanation_cache_size: 512
      explanation_timeout_s: 8.0

      hunt_max_results: 200
      hunt_timeout_s: 8.0

      rule_suggestion_min_tp: 5
      rule_suggestion_window_days: 14
    ```

See [LLM Integration](../detection/llm.md).

---

## UEBA

Per-entity behavioural analytics. Scores each event against the entity's
own baseline across four dimensions (time-of-day, source novelty,
volume, pattern novelty).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ueba.enabled` | `bool` | `true` | Master switch. |
| `ueba.warmup_days` | `int` | `7` | Baseline accumulation window. |
| `ueba.warmup_min_events` | `int` | `50` | Minimum events seen for an entity before it is scored. |
| `ueba.max_entities` | `int` | `100000` | LRU cap on tracked entities. |
| `ueba.ema_alpha` | `float` | `0.05` | Temporal decay for streaming baselines. |
| `ueba.source_ip_cap` | `int` | `64` | Top-K distinct source IPs tracked per entity. |
| `ueba.template_top_k` | `int` | `32` | Top-K Drain3 templates tracked per entity. |
| `ueba.score_threshold` | `float` | `0.75` | Alert threshold on the blended UEBA score. |
| `ueba.alert_cooldown_seconds` | `int` | `900` | Per-entity alert suppression window. |
| `ueba.sub_score_weights.time_of_day` | `float` | `0.25` | Weight for time-of-day novelty. |
| `ueba.sub_score_weights.source_novelty` | `float` | `0.30` | Weight for source novelty. |
| `ueba.sub_score_weights.volume` | `float` | `0.20` | Weight for volume z-score. |
| `ueba.sub_score_weights.pattern_novelty` | `float` | `0.25` | Weight for pattern novelty. |

`sub_score_weights` must sum to `1.0 ± 1e-6`.

See [UEBA](../detection/ueba.md).

---

## Threat Intel

STIX/TAXII 2.1 feed polling and Bloom-filter IoC matching.

### Top-level

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threat_intel.enabled` | `bool` | `false` | Master switch. |
| `threat_intel.feeds` | `list[obj]` | `[]` | TAXII feed configs (see below). |
| `threat_intel.default_poll_interval_s` | `int` | `3600` | Default feed poll interval. |
| `threat_intel.request_timeout_s` | `float` | `30.0` | Per-request HTTP timeout. |
| `threat_intel.max_indicators_per_feed` | `int` | `1000000` | Hard cap per feed. |
| `threat_intel.expired_grace_days` | `int` | `30` | Stale-indicator retention before purge. |
| `threat_intel.startup_jitter_s` | `int` | `30` | Random startup delay to stagger polling. |

### Feed entry (`threat_intel.feeds[*]`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `str` | required | Feed identifier (used in logs and dedup). |
| `url` | `str` | required | TAXII discovery URL. |
| `collection_id` | `str` | required | TAXII collection ID. |
| `poll_interval_s` | `int?` | `null` | Per-feed override of `default_poll_interval_s`. |
| `confidence_floor` | `int` | `0` | Drop indicators below this confidence. |
| `enabled` | `bool` | `true` | Per-feed flag. |
| `allow_insecure` | `bool` | `false` | Allow self-signed TLS. |
| `allow_private_addresses` | `bool` | `false` | Allow URLs resolving to private IPs (defense against DNS rebinding). |
| `auth` | `obj?` | `null` | Optional credentials (see below). |

#### Feed auth (`threat_intel.feeds[*].auth`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `kind` | `str` | required | `api_key` or `basic`. |
| `api_key_env` | `str?` | — | Environment variable holding the API key (`kind: api_key`). |
| `api_key_header` | `str` | `Authorization` | Header name carrying the key. |
| `username_env` | `str?` | — | Environment variable holding the username (`kind: basic`). |
| `password_env` | `str?` | — | Environment variable holding the password (`kind: basic`). |

**All secrets must be referenced via env-var names — no plaintext credentials in the config file.**

### IoC matcher (`threat_intel.matcher`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | `bool` | `false` | Enable the in-process Bloom-filter matcher. |
| `fpr` | `float` | `0.001` | Target false-positive rate. |
| `min_capacity` | `int` | `100000` | Minimum Bloom-filter capacity. |
| `capacity_growth_factor` | `float` | `1.25` | Growth factor on rebuild. |
| `confidence_floor` | `int` | `0` | Drop indicators below this confidence on insert. |
| `rebuild_debounce_ms` | `int` | `200` | Wait between filter rebuilds. |
| `enabled_types` | `list[str]` | `[ipv4, ipv6, domain, url, md5, sha1, sha256]` | Indicator types matched. |

See [Threat Intel](../correlation/threat-intel.md).

---

## WebSocket

Dashboard live-event stream tuning.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ws_max_connections` | `int` | `20` | Maximum concurrent WebSocket clients. |
| `ws_queue_maxlen` | `int` | `1000` | Per-client buffer length. |
| `ws_tick_interval_s` | `float` | `0.01` | Flush tick interval (s). |
| `ws_batch_max_events` | `int` | `10` | Maximum events per flushed batch. |
| `ws_status_interval_s` | `float` | `5.0` | Status frame cadence. |
| `ws_allowed_origins` | `list[str]` | `[]` | Explicit Origin allowlist for WebSocket clients. Empty = derive from `dashboard_port` (localhost). |
| `ws_filter_min_interval_ms` | `int` | `100` | Minimum interval between client-side filter updates. |

---

## API

REST API hardening (S-181).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `api_rate_limit_enabled` | `bool` | `true` | Enable per-endpoint rate limiting. |
| `api_rate_limit_redis_url` | `str?` | `null` | Optional Redis backing store for distributed limits. Credentials redacted from `GET /api/v1/config`. |
| `api_allowed_origins` | `list[str]` | `[]` | CORS allowlist. |
| `api_list_rate_limit` | `str` | `"60/minute"` | Limit for list endpoints. |
| `api_detail_rate_limit` | `str` | `"300/minute"` | Limit for detail endpoints. |
| `api_coverage_rate_limit` | `str` | `"10/minute"` | Limit for coverage matrix endpoints. |
| `api_trust_proxy_headers` | `bool` | `false` | Honour `X-Forwarded-For` for rate-limit keying. Set `true` only when behind a trusted reverse proxy. |

See [API Reference](api.md).

---

## Runtime

Top-level keys (not nested under any section).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dashboard_port` | `int` | `8080` | Port for the built-in dashboard HTTP server (1–65535). |
| `health_bind_address` | `str` | `"127.0.0.1"` | IP to bind the health-check endpoint. Defaults to loopback. |
| `log_level` | `str` | `"INFO"` | One of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |

---

## Environment Variables

All string values in `seerflow.yaml` support `${VAR}` / `${VAR:-default}`
interpolation. Interpolation happens at load time, before validation.

| Syntax | Behaviour |
|--------|-----------|
| `${VAR}` | Substitutes the value of `VAR`. Raises `ConfigError` at startup if `VAR` is unset. |
| `${VAR:-default}` | Substitutes `VAR` if set; falls back to `default` otherwise. |

!!! example "Common Environment Variable Patterns"
    ```yaml
    storage:
      postgresql_url: ${DATABASE_URL}

    alerting:
      pagerduty_routing_key: ${PD_ROUTING_KEY:-}
      dashboard_url: ${SEERFLOW_DASHBOARD_URL:-http://localhost:8080}

      webhooks:
        - url: ${SLACK_WEBHOOK_URL}
          format: slack
          min_severity: 3
    ```

---

## Configuration Examples

### Minimal Configuration

The smallest viable `seerflow.yaml`. All other knobs use built-in defaults.

```yaml
storage:
  data_dir: /var/lib/seerflow

receivers:
  syslog_enabled: true
  otlp_grpc_enabled: true
  otlp_http_enabled: false
```

With this configuration, Seerflow starts with:

- SQLite storage at `/var/lib/seerflow/seerflow.db` + in-process igraph
- Syslog receiver on UDP 514 and TCP 601
- OTLP gRPC receiver on port 4317
- All ML detectors at default sensitivity
- UEBA enabled (warmup 7 d), Threat Intel and LLM disabled
- No alerting sinks (alerts persisted, dashboard-visible)

### Full Configuration

Annotated example showing all sections with commonly-tuned values.

```yaml
log_level: INFO
dashboard_port: 8080
health_bind_address: "127.0.0.1"

storage:
  backend: postgresql
  postgresql_url: ${DATABASE_URL}
  postgresql_pool_min_size: 4
  postgresql_pool_max_size: 32
  graph_backend: falkordb
  falkordb_url: ${FALKORDB_URL}

receivers:
  syslog_enabled: true
  otlp_grpc_enabled: true
  otlp_grpc_max_workers: 8
  otlp_http_enabled: true
  otlp_http_max_request_bytes: 8388608
  file_paths:
    - /var/log/app/*.log
  file_checkpoint_dir: /var/lib/seerflow/checkpoints
  allowed_log_roots: ["/var/log"]
  bind_addr: "0.0.0.0"
  queue_maxsize: 50000

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
  graph_algo_interval: 500
  risk_half_life_hours: 4
  risk_threshold: 50.0
  kill_chain:
    enabled: true
    tactic_threshold: 3
    window_seconds: 86400
  graph_structural:
    betweenness_threshold: 0.3
    fan_out_sigma: 3.0
    community_crossing_enabled: true
  sigma_rules_dirs:
    - /etc/seerflow/sigma

correlation:
  window_duration_seconds: 1800
  max_events_per_entity: 1000
  max_entities: 10000
  late_tolerance_seconds: 30
  rule_dirs:
    - /etc/seerflow/rules/correlation

alerting:
  dedup_window_seconds: 900
  dashboard_url: ${SEERFLOW_DASHBOARD_URL:-}
  pagerduty_routing_key: ${PD_ROUTING_KEY:-}
  otlp_endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:-}
  otlp_protocol: grpc
  otlp_tls: true
  email_targets:
    - name: ops-email
      smtp_host: smtp.example.com
      smtp_port: 587
      use_starttls: true
      from_address: alerts@example.com
      to_addresses: [oncall@example.com]
      smtp_user: alerts
      smtp_password: ${SMTP_PASSWORD}
  routing_rules:
    - match: { alert_type: sigma, min_severity: 4 }
      notify:
        - { channel: ops-email, mode: immediate }

llm:
  backend: ollama
  ollama_model: phi4-mini
  hunt_max_results: 200
  rule_suggestion_min_tp: 5

ueba:
  enabled: true
  warmup_days: 7
  score_threshold: 0.75

threat_intel:
  enabled: true
  feeds:
    - id: misp-public
      url: https://misp.example.com/taxii2/
      collection_id: indicators
      auth:
        kind: api_key
        api_key_env: MISP_API_KEY
  matcher:
    enabled: true
    fpr: 0.001

ws_max_connections: 50
api_rate_limit_enabled: true
api_list_rate_limit: "120/minute"
```
