# LLM Integration

Seerflow uses an LLM as an **auxiliary** signal — never as a primary
detector. Traditional ML and Sigma cover the high-volume, latency-
sensitive paths; the LLM handles low-volume, high-value workflows
where natural language helps:

| Service | Trigger | Output |
|---------|---------|--------|
| **Alert explanation** | Operator clicks *Explain* on an alert. | Markdown summary of the alert with contributing events, MITRE context, and remediation hints. |
| **Natural-language hunt** | `seerflow hunt "…"` / `POST /api/v1/hunt`. | An internal `EventQuery` translated from the prompt, executed against the event store. |
| **Sigma rule suggestion** | Pattern seeded by ≥ N TP feedbacks. | Draft Sigma YAML, validated by `pySigma` before display. |

All three services are **opt-in**. They are disabled by default — the
core pipeline runs without ever calling the LLM.

## Backend selection

Set the backend via [`llm.backend`](../reference/config.md#backend-selection):

| Value | Provider | Use case |
|-------|----------|----------|
| `""` | (disabled) | Default; LLM features off. |
| `"llama_cpp"` | `llama-cpp-python` | Single-host, CPU/GPU, fully offline. |
| `"ollama"` | Local Ollama daemon (HTTP) | Shared host within the network, easy model swaps. |
| `"cloud"` | Anthropic / OpenAI SDK | Best quality, lowest latency; egress required. |

### `llama_cpp`

```yaml
llm:
  backend: llama_cpp
  model_path: /opt/models/phi-4-mini-instruct-q4.gguf
  n_ctx: 4096
  n_gpu_layers: 0      # set > 0 to offload to GPU
```

### `ollama`

```yaml
llm:
  backend: ollama
  ollama_url: http://ollama.internal:11434
  ollama_model: phi4-mini
  ollama_timeout_s: 8.0
```

### `cloud`

```yaml
llm:
  backend: cloud
  cloud_provider: anthropic        # or "openai"
  cloud_model:    claude-haiku-4-5-20251001
  cloud_api_key:  ${ANTHROPIC_API_KEY}
  cloud_timeout_s: 8.0
```

All knobs are documented in [Config Reference →
LLM](../reference/config.md#llm).

## Alert explanation

When the dashboard requests an explanation, Seerflow:

1. Looks up the alert and a bounded number of contributing events
   (`llm.explanation_max_contributing_events`, default 8).
2. Builds a prompt capped at `llm.explanation_max_prompt_chars`.
3. Calls the backend with `llm.explanation_timeout_s` (default 12 s).
4. Caches the result in a per-process LRU
   (`llm.explanation_cache_size` / `llm.explanation_cache_ttl_s`).

Subsequent `GET /api/v1/alerts/{id}/explanation` calls return the
cached entry until TTL expiry.

If the LLM is disabled or fails, the endpoints respond with
`503` / `502` respectively — the alert detail view degrades to a
plain summary without blocking.

## Hunt (NL → query)

The hunt service converts a natural-language query into an
`EventQuery` (entity / time-range / source filters). Output is then
executed against the configured event store — the LLM never returns
event data directly.

Cache keys are derived from the **canonicalised query string**, so
two analysts typing the same hunt share results. Cache parameters:
`llm.hunt_cache_size`, `llm.hunt_cache_ttl_s`.

Hard limits:

- `llm.hunt_max_query_chars` — prompt size cap (default 512).
- `llm.hunt_max_results` — default `--limit` for `seerflow hunt`
  (override per-call).

### Deterministic fallback

`POST /api/v1/hunt` and `seerflow hunt` parse the query for an
entity-style token (IPv4, hostname, entity UUID5) **before** the LLM
call. When the token matches, the request short-circuits to an
entity-timeline lookup, so the hunt surface stays usable when the LLM
is unavailable.

## Sigma rule suggestion

When an alert accumulates `≥ llm.rule_suggestion_min_tp` true-positive
feedbacks (default 3), the corresponding alert pattern becomes
*eligible* for rule drafting:

1. Operator opens the **Rule Suggestions** tab.
2. Picks an eligible pattern → backend generates a Sigma draft.
3. Draft is validated by `pySigma` before display — a syntactically
   invalid draft never reaches the operator.
4. Operator can edit, dry-run, and upload via
   `POST /api/v1/sigma/rules`.

Cache: `llm.rule_suggestion_cache_size` /
`llm.rule_suggestion_cache_ttl_s` (default 6 h — operators rarely
re-draft within a session).

Look-back window: `llm.rule_suggestion_window_days` (default `0` =
all time).

## Cost and latency

- **Caching is the primary cost lever.** Tune `*_cache_ttl_s` upward
  for stable environments; downward when alert distribution shifts
  rapidly.
- **Timeouts default to 12 s** for hunt / explanation and 30 s for
  rule suggestion (structured YAML output is heavier). Reduce when
  using a cloud backend with sub-second latency.
- **Model choice trumps tuning.** A 14 B local model on CPU may take
  20 – 40 s for an explanation; a Haiku-class cloud call typically
  finishes in 1 – 3 s.

## Security

- `llm.cloud_api_key` is redacted from `repr(LLMConfig)` and from
  `GET /api/v1/config`.
- Alert prompts include event fields but **never raw entity values
  for fields marked sensitive** (e.g. usernames are hashed before
  egress when `cloud` is selected and the relevant policy flag is
  enabled).
- No PII is sent unsolicited — explanations and hunt are
  user-initiated.

For the API surface, see
[REST API → Hunt / Explanations / Sigma](../reference/api.md#hunt).
