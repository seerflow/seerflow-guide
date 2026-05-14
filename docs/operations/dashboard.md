# Dashboard

Seerflow ships with a built-in web dashboard — a single-page React
application served by the Seerflow process itself. There is no
separate frontend service to deploy.

The dashboard is a thin client over the [REST API](../reference/api.md)
and the [WebSocket stream](../reference/api.md#websocket-apiv1ws);
everything visible in the UI is also available programmatically.

## Accessing the dashboard

```
http://<host>:<dashboard_port>/
```

Defaults to `http://localhost:8080/`. Change with the top-level
[`dashboard_port`](../reference/config.md#runtime) key.

For non-local deployments, expose the dashboard via a reverse proxy
that terminates TLS and enforces authentication. The default bind is
designed for single-host operation behind a trusted proxy.

## Layout

The dashboard uses a draggable, resizable grid (powered by
`react-grid-layout`). Layout state is persisted in the browser's
local storage, scoped per user.

Default widgets:

| Widget | Purpose |
|--------|---------|
| **Live Event Stream** | Real-time tail of newly ingested events; supports server-side filters via the WebSocket `filter` frame. |
| **Alert Feed** | Newest alerts first; severity-colored, with one-click drill-down to alert detail. |
| **Anomaly Timeline** | Bucketed anomaly-score series with overlaid alert counts. Range / resolution selector. |
| **Entity Explorer** | Force-directed entity graph (d3-force). Click an entity to open its timeline + risk history + UEBA baseline. |
| **ATT&CK Heatmap** | Coverage matrix coloured by 24 h fire counts per technique. |
| **Sigma Rules** | Browsable rule catalog with enable/disable toggle, YAML viewer (Monaco), and per-rule 24 h trend. |

Widgets can be added, removed, or rearranged from the **Layout** menu
in the top-right toolbar.

## Real-time stream

The live stream is delivered over a single WebSocket connection at
`/api/v1/ws`. Each open dashboard counts against
[`ws_max_connections`](../reference/config.md#websocket).

Backpressure: when a client falls behind, Seerflow drops the oldest
frames first and sends a `status` frame with `dropped: N` so the UI
can surface a "stream lagging" banner.

Filter changes are throttled to one update every
`ws_filter_min_interval_ms` (default 100 ms) to avoid filter churn on
keystroke-driven UIs.

## Alert triage flow

1. Pick an alert from the **Alert Feed**.
2. The detail pane opens with contributing events, mapped ATT&CK
   tactics/techniques, related entities, and (if LLM is configured) an
   on-demand **Explain** button that calls
   `POST /api/v1/alerts/{id}/explain`.
3. Submit feedback (TP / FP) inline. The feedback is persisted and
   flows into the DSPOT threshold adjuster ([Alerting →
   Feedback Loop](alerting.md#feedback-loop)) and into LLM rule
   suggestions.

## Threat hunting

The **Hunt** tab takes a natural-language query and dispatches it to
`POST /api/v1/hunt`. When the LLM is unavailable, the same endpoint
falls back to a deterministic entity-timeline lookup if the query
matches an entity (IP / hostname / UUID5) — so hunt is useful even
without LLM configured.

See [LLM Integration](../detection/llm.md).

## Sigma rule management

The **Sigma Rules** widget allows operators to:

- Browse the loaded rule catalog (bundled + custom).
- Toggle individual rules on/off (`PATCH /api/v1/sigma/rules/{id}`).
- Upload a custom YAML rule (`POST /api/v1/sigma/rules`). Uploaded
  rules persist to
  [`detection.sigma_custom_upload_dir`](../reference/config.md#sigma-attck)
  and survive restart.
- Review LLM rule-suggestion drafts seeded by TP feedbacks
  (`POST /api/v1/sigma/rule-suggestions/{pattern_key}`).

## Security headers and CORS

The dashboard ships with strict CSP, Origin validation on the
WebSocket, and the API enforces a CORS allowlist via
[`api_allowed_origins`](../reference/config.md#api). Run behind a
reverse proxy that adds `Strict-Transport-Security`, HSTS, and
authentication for any non-localhost deployment.

## Build and customise

The frontend source lives in `frontend/` and is bundled with Vite. The
compiled bundle is committed under `src/seerflow/web/dist/` so the
Python package is self-contained — no Node.js is required at install
time.

To rebuild from source:

```bash
cd frontend
npm ci
npm run build
```

The output is written to `../src/seerflow/web/dist/` and served by the
Python process from there.
