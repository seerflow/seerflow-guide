# REST API & WebSocket Reference

Seerflow exposes a versioned HTTP API and a single WebSocket stream
under the dashboard process. The dashboard SPA and external integrations
use the same endpoints — there is no separate private API.

## Base URL and Version

All routes are prefixed with `/api/v1`. The dashboard listens on
`dashboard_port` (default `8080`). Health probes bind to
`health_bind_address` (default `127.0.0.1`).

```
http://<host>:<dashboard_port>/api/v1/...
ws://<host>:<dashboard_port>/api/v1/ws
```

## Conventions

- **Content types:** request bodies are JSON; responses are JSON unless
  noted.
- **Pagination:** list endpoints accept `page` (1-based) and `limit`.
  The response includes a `meta` envelope: `{total, page, limit}`.
- **Time windows:** `since` / `until` accept ISO-8601 timestamps; some
  endpoints additionally accept relative ranges (`range=1h|6h|24h|7d`)
  paired with `resolution=1m|5m|15m|1h`.
- **Errors:** standard HTTP status codes. `404` = resource not found,
  `503` = subsystem not ready (LLM disabled, config not loaded, UEBA
  warming up), `502` = upstream LLM failure, `409` = idempotency
  collision, `422` = validation failure, `507` = storage capacity
  exceeded.

## Rate Limiting

Configured via the top-level `api_*` keys
([Config Reference → API](config.md#api)). Three families:

| Family | Default | Endpoints |
|--------|---------|-----------|
| List | `60/minute` | `/events`, `/alerts`, `/sigma/rules`, … |
| Detail | `300/minute` | `/alerts/{id}`, `/entities/{uuid}/...`, … |
| Coverage | `10/minute` | `/attack/coverage` |

Set `api_rate_limit_redis_url` to scale limits across multiple Seerflow
instances. Set `api_trust_proxy_headers: true` only when behind a
trusted reverse proxy.

## CORS

`api_allowed_origins` enumerates browser origins permitted to call the
API. Empty = same-origin only.

---

## Alerts

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/alerts` | Paginated alert search. |
| `GET` | `/alerts/{alert_id}` | Single alert. |
| `POST` | `/alerts/{alert_id}/feedback` | Submit TP/FP feedback. |
| `GET` | `/alerts/{alert_id}/feedback` | Newest-first feedback audit log. |
| `POST` | `/alerts/{alert_id}/explain` | Generate or fetch a cached LLM explanation. |
| `GET` | `/alerts/{alert_id}/explanation` | Return cached explanation only (never invokes the LLM). |

### `GET /alerts`

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `since`, `until` | ISO-8601 | Window. |
| `type` | `ml,sigma,correlation,ueba,ioc` | Alert type filter. |
| `severity` | int | Minimum severity. |
| `entity` | string | Entity UUID5 or value (IP, hostname, user). |
| `tactic` | string | ATT&CK tactic name. |
| `technique` | string | ATT&CK technique ID (prefix-matched). |
| `page`, `limit` | int | Pagination (max `limit = 1000`). |

### `POST /alerts/{alert_id}/feedback`

Body:

```json
{
  "feedback": "tp",
  "note": "Confirmed lateral movement",
  "origin": "console"
}
```

Returns `204 No Content`. `404` if alert missing.

### `POST /alerts/{alert_id}/explain`

Generates a markdown explanation via the configured LLM backend.
Subsequent calls return the cached entry until TTL expiry
([`llm.explanation_*`](config.md#alert-explanation)).

- `503` if LLM disabled / backend not ready.
- `502` on upstream LLM failure.
- `404` if alert missing.

---

## Events

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/events` | Paginated event search. |

Query parameters: `since`, `until`, `source`, `severity`, `template_id`,
`entity`, `q` (free-text substring search), `page`, `limit` (max
`1000`).

---

## Entities

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/entities/search` | Entity search by free-text value or UUID. |
| `GET` | `/entities/{entity_uuid}/timeline` | Cross-source event timeline + related entities. |
| `GET` | `/entities/{entity_uuid}/risk-history` | Bucketed risk-score series. |
| `GET` | `/entities/{entity_uuid}/baseline` | Current UEBA baseline. |

### `GET /entities/search`

| Param | Type | Description |
|-------|------|-------------|
| `q` | string (1–256 chars) | Free-text or UUID. |

Returns IP, user, host, and domain UUIDs ranked by relevance.

### `GET /entities/{entity_uuid}/timeline`

| Param | Type | Description |
|-------|------|-------------|
| `start_ns`, `end_ns` | int (ns) | Time bounds. |
| `source_type` | string | Filter by source. |
| `severity_min` | int | Minimum severity. |
| `limit` | int | Max events (cap `10_000`). |

### `GET /entities/{entity_uuid}/baseline`

Returns the UEBA baseline for the entity (top-K sources, top-K
templates, hour-of-day distribution, volume EMA).

- `503` if UEBA disabled.
- `404` if entity unknown.
- `404` with `status: warming_up` while inside the warmup window.

---

## Anomaly

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/anomaly/timeline` | Bucketed anomaly-score series with alert counts. |

| Param | Type | Description |
|-------|------|-------------|
| `range` | `1h,6h,24h,7d` | Window length. |
| `resolution` | `1m,5m,15m,1h` | Bucket size. |
| `source` | string | Filter by source. |

---

## ATT&CK Coverage

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/attack/coverage` | ATT&CK matrix with per-technique fire counts. |

| Param | Type | Description |
|-------|------|-------------|
| `since`, `until` | ISO-8601 | Window. Default: last 30 days. |

Rate-limited under `api_coverage_rate_limit` (default `10/minute`).

---

## Hunt

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/hunt` | Natural-language threat hunt via LLM. |

Body:

```json
{ "query": "failed logins by service accounts in the last hour" }
```

- `503` if LLM not ready.
- `502` on upstream LLM failure.
- `400` on invalid or over-budget query (see
  [`llm.hunt_max_query_chars`](config.md#hunt-nl-query)).

Falls back to a deterministic entity-timeline lookup when the query
matches an entity (IP, hostname, UUID5).

---

## Sigma Rules

All paths under `/sigma`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/sigma/rules` | Paginated rule list with 24 h fire counts. |
| `GET` | `/sigma/rules/{rule_id}` | Single rule incl. YAML. |
| `GET` | `/sigma/rules/{rule_id}/timeline` | 24 h hourly firing trend. |
| `PATCH` | `/sigma/rules/{rule_id}` | Toggle `enabled`. |
| `POST` | `/sigma/rules` | Upload custom rule (validate + persist). |
| `GET` | `/sigma/rule-suggestions` | List TP-feedback patterns eligible for LLM drafting. |
| `POST` | `/sigma/rule-suggestions/{pattern_key}` | Draft a Sigma YAML for the pattern. |
| `DELETE` | `/sigma/rule-suggestions/{pattern_key}` | Invalidate cached suggestion. |

### `POST /sigma/rules`

Body:

```json
{ "yaml": "<sigma yaml>", "dry_run": false }
```

- `201` on success.
- `409` on rule-ID collision.
- `422` on validation failure (returns line/column).
- `507` if `detection.sigma_custom_upload_dir` is full.

### `POST /sigma/rule-suggestions/{pattern_key}`

`pattern_key` has the form `alert_type:rule_name:entity_type`. Returns
drafted YAML + supporting evidence (TP feedbacks, contributing events).

- `503` if LLM disabled / backend not ready.
- `502` on upstream LLM failure.
- `404` if the pattern no longer satisfies `rule_suggestion_min_tp`.

---

## System

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Service health and component readiness. |
| `GET` | `/stats` | Pipeline counters and live metrics. |
| `GET` | `/config` | Running config with secrets redacted. |

`GET /health` returns HTTP `503` when any component is degraded; the
body includes per-component detail and detection / feedback extras.

`GET /config` masks every credential-bearing field (`postgresql_url`,
`falkordb_url`, `api_rate_limit_redis_url`, channel tokens, …).

---

## WebSocket — `/api/v1/ws`

Real-time event and alert stream consumed by the dashboard's live feed.

### Connect

```
GET /api/v1/ws
Upgrade: websocket
Origin: https://dashboard.example.com
```

Origin is validated against `ws_allowed_origins` (defaults to localhost
derived from `dashboard_port`) — required for CSWSH defence.

`ws_max_connections` caps concurrent clients (default `20`).

### Server → client frames

| `type` | Description |
|--------|-------------|
| `event` | Single newly-ingested event. |
| `alert` | Single newly-generated alert. |
| `batch` | Up to `ws_batch_max_events` events, flushed on the `ws_tick_interval_s` tick. |
| `alert_batch` | Coalesced alerts on the same flush. |
| `status` | Periodic backpressure / health frame on `ws_status_interval_s`. |

### Client → server frames

```json
{
  "type": "filter",
  "min_severity": 3,
  "source": ["nginx", "syslog"],
  "entity": "550e8400-e29b-41d4-a716-446655440000"
}
```

Filter updates are throttled to one every `ws_filter_min_interval_ms`.

### Backpressure

Per-client buffer length: `ws_queue_maxlen`. When a client cannot keep
up, Seerflow drops oldest frames first and emits a `status` frame with
`dropped: N`.

---

## Authentication

The default deployment binds the dashboard to `127.0.0.1` and assumes
network-level access control (reverse proxy, VPN, or SSH tunnel).
Authentication / RBAC integration is planned post-1.0 and is not yet
documented here.

For now, expose the dashboard publicly only via a reverse proxy that
terminates TLS and enforces authentication.
