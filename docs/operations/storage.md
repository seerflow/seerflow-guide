# Storage Layer

Seerflow separates storage concerns into five Protocol interfaces. A single configuration line selects which backend implements all five simultaneously. The two supported backends are SQLite (zero-config default) and PostgreSQL (production scale). For where storage fits in the overall data flow, see [Pipeline Architecture](../architecture/pipeline.md).

## Architecture Overview

```mermaid
flowchart TB
    Pipeline["Pipeline Handler"]

    Pipeline --> LogStore["LogStore\n(event persistence)"]
    Pipeline --> AlertStore["AlertStore\n(alert CRUD)"]
    Pipeline --> ModelStore["ModelStore\n(ML state)"]
    Pipeline --> EntityStore["EntityStore\n(entity timelines)"]
    Pipeline --> GraphStore["GraphStore\n(entity graph)"]

    LogStore --> SQLite["SQLite Backend"]
    AlertStore --> SQLite
    ModelStore --> SQLite
    EntityStore --> SQLite
    GraphStore --> SQLite

    LogStore -.-> PG["PostgreSQL Backend"]
    AlertStore -.-> PG
    ModelStore -.-> PG
    EntityStore -.-> PG
    GraphStore -.-> PG

    style SQLite fill:#1e40af,color:#fff
    style PG fill:#374151,color:#fff,stroke-dasharray:5 5
```

One config line switches all five interfaces at once:

```yaml
storage:
  backend: sqlite      # or: postgresql
```

The pipeline never imports a concrete backend class directly — it depends only on the Protocol types, so swapping backends requires no code changes.

## Protocol Interfaces

All methods are `async`. All Protocols are `@runtime_checkable`, which allows startup validation via `isinstance()` checks.

| Protocol | Purpose | Key Methods |
|---|---|---|
| `LogStore` | Event persistence and full-text search | `write_events`, `query_events`, `search_text`, `flush` |
| `AlertStore` | Alert CRUD with deduplication | `write_alert`, `query_alerts`, `update_feedback`, `get_alert_by_id`, `get_feedback_stats` |
| `ModelStore` | ML model state key-value store | `save_state`, `load_state` |
| `EntityStore` | Entity timeline and relationship queries | `get_timeline`, `get_related`, `set_entity_graph` |
| `GraphStore` | Entity relationship graph operations | `write_edge`, `load_edges`, `get_neighbors`, `shortest_path`, `get_subgraph` |

### LogStore

```python
async def write_events(self, events: list[SeerflowEvent]) -> None
async def query_events(self, filters: EventQuery) -> Page[SeerflowEvent]
async def search_text(self, query: str, limit: int) -> list[SeerflowEvent]
async def flush(self) -> None
```

`search_text` treats the query as a plain-text substring — no SQL or regex interpretation. Backends clamp the result count to an internal ceiling to prevent unbounded result sets.

### AlertStore

```python
async def write_alert(self, alert: Alert, dedup_window_ns: int = 900_000_000_000) -> bool
async def query_alerts(self, filters: AlertQuery) -> Page[Alert]
async def update_feedback(self, alert_id: str, feedback: FeedbackType) -> None
async def get_alert_by_id(self, alert_id: str) -> Alert | None
async def get_feedback_stats(self) -> dict[str, int]
```

`write_alert` returns `True` for a new insert or window-reset (dedup_count == 1), and `False` when the alert was a duplicate bump within the dedup window. The default window is 15 minutes (900,000,000,000 ns).

### ModelStore

```python
async def save_state(self, key: str, data: bytes) -> None
async def load_state(self, key: str) -> bytes | None
```

Keys must be non-empty, ASCII-only, and at most 256 characters. `load_state` returns `None` when no state exists for the key — callers must handle `None` by initializing a fresh model. See [Model Persistence](#model-persistence) for key conventions.

### EntityStore

```python
async def get_timeline(
    self,
    entity_uuid: str,
    time_range: TimeRange,
    source_type: str | None = None,
    severity_min: int | None = None,
    limit: int = 10_000,
) -> list[SeerflowEvent]
async def get_related(self, entity_uuid: str) -> list[EntityRelation]
def set_entity_graph(self, graph: EntityGraph) -> None
```

`get_timeline` returns events for a single entity within a time range, sorted chronologically. `get_related` delegates to the in-memory `EntityGraph` for relationship queries — call `set_entity_graph` before using it.

### GraphStore

```python
async def write_edge(
    self, source_id: str, target_id: str, rel_type: str, timestamp_ns: int
) -> None
async def load_edges(self) -> list[tuple[str, str, str, int, int, int]]
async def get_neighbors(
    self, entity_id: str, rel_types: tuple[str, ...] | None = None, depth: int = 1
) -> list[dict[str, str]]
async def shortest_path(self, source_id: str, target_id: str) -> list[str]
async def get_subgraph(self, entity_id: str, depth: int = 2) -> tuple[list[str], list[dict[str, str]]]
```

`load_edges` is called at startup to rebuild the in-memory `EntityGraph` from persisted edges. The return type is a list of `(source_id, target_id, rel_type, first_seen_ns, last_seen_ns, event_count)` tuples.

## SQLite Backend

### When to Use

SQLite is the right choice for:

- Local development and testing
- Single-instance deployments
- Log volumes under a few million events per day
- Environments where zero-config startup matters

### WAL Mode

The SQLite backend opens with Write-Ahead Logging enabled:

```sql
PRAGMA journal_mode=WAL
```

WAL allows multiple concurrent readers while a single writer is active. Additional pragmas configure an 8 KiB page size, a 64 MiB in-memory page cache, 256 MiB memory-mapped I/O, and a 5-second busy timeout on locked databases. Durability is set to `NORMAL` — data is safe after a crash but there is roughly a 100 ms exposure window on unexpected power loss.

### WriteBuffer

Writes are not committed one event at a time. The `WriteBuffer` accumulates events and flushes to SQLite when either threshold is reached:

- **Size threshold:** 1,000 events
- **Time threshold:** 100 ms (periodic background task)

The flush lock protects only the buffer drain, so `append()` is never blocked by a database write. Call `flush()` explicitly before shutdown to persist any buffered events.

```yaml
# No config needed — WriteBuffer is always active on the SQLite backend.
# Use flush() in your shutdown sequence if managing the backend directly.
```

### Full-Text Search (FTS5)

The `events_fts` virtual table provides full-text search over event message bodies using the Porter stemmer and Unicode tokenization:

```sql
CREATE VIRTUAL TABLE events_fts USING fts5(
    message,
    content=events,
    content_rowid=rowid,
    tokenize='porter unicode61'
);
```

Before any query reaches FTS5, the input is sanitized:

1. Non-printable characters are removed.
2. Single and double quotes are stripped.
3. Leading and trailing whitespace is trimmed.
4. The string is capped at **256 characters**.
5. The result is wrapped in FTS5 phrase quotes, disabling all FTS5 operators (AND, OR, NOT, NEAR).

Result sets are clamped at **10,000 events** regardless of the `limit` argument. Empty queries return an empty list without touching the database.

### Schema Auto-Creation

The schema is created automatically on first connection via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements. No migration tool or manual setup is required for a fresh database.

### Configuration

```yaml
storage:
  backend: sqlite
  data_dir: /var/lib/seerflow       # parent directory for the database file
  sqlite_path: /var/lib/seerflow/seerflow.db  # explicit path (overrides data_dir)
```

`data_dir` defaults to the platform data directory (`~/.local/share/seerflow` on Linux). `sqlite_path` defaults to `<data_dir>/seerflow.db`. Paths containing null bytes are rejected at startup.

## PostgreSQL Backend

### When to Migrate

Switch to PostgreSQL when:

- Log volume exceeds what a single SQLite writer can sustain
- Multiple pipeline instances must share the same storage
- You need high-availability or read replicas
- Your operations team already manages a PostgreSQL cluster

### asyncpg

The PostgreSQL backend uses `asyncpg` for connection pooling and prepared statement caching. This avoids per-query planning overhead for the hot write paths (event inserts, alert upserts, model state saves).

### Configuration

```yaml
storage:
  backend: postgresql
  postgresql_url: "postgresql://user:password@host:5432/seerflow"
```

!!! tip "Environment variable interpolation"
    Keep credentials out of config files. Set the URL via an environment variable and reference it:

    ```bash
    export SEERFLOW_POSTGRESQL_URL="postgresql://seerflow:secret@db:5432/seerflow"
    ```

    Then in `seerflow.yaml`:

    ```yaml
    storage:
      backend: postgresql
      postgresql_url: ""   # leave blank to use the environment variable
    ```

!!! warning "PostgreSQL feedback updates"
    The SQLite `update_feedback` implementation uses a SELECT then UPDATE. On PostgreSQL, this **must** use `SELECT ... FOR UPDATE` inside a transaction to prevent concurrent writes from being lost. Verify your PostgreSQL backend implementation includes this guard before deploying to production.

## Model Persistence

Detection models (Half-Space Trees, CUSUM, Markov chains, Holt-Winters) are serialized to bytes and stored in the `model_state` table via `ModelStore`.

### Key Convention

Keys follow the pattern `<model_type>:<entity_or_scope>`:

| Key | Model |
|---|---|
| `hst:host:web-01` | Half-Space Trees model for host `web-01` |
| `cusum:global` | CUSUM detector at global scope |
| `hw:source:nginx` | Holt-Winters volume model for `nginx` source |
| `markov:user:alice` | Markov chain sequence model for user `alice` |

Key constraints: non-empty, ASCII-only, maximum 256 characters. These are validated before every read and write.

### Checkpoint Interval

Models are saved on a periodic timer controlled by:

```yaml
detection:
  model_save_interval_seconds: 300   # default: 5 minutes
```

The minimum accepted value is 1 second. At each checkpoint, all active model states are serialized and passed to `save_state`. On startup, `load_state` returns the persisted bytes or `None` — a `None` result means a fresh model is initialized from scratch (first run or after a key rotation).

### Serialization

Model state is stored as raw bytes (msgpack or pickle, depending on the model type). The `ModelStore` interface is intentionally format-agnostic — it stores and retrieves `bytes` and does not inspect the content. The detection layer is responsible for choosing and maintaining a stable serialization format.

## ER Diagram

```mermaid
erDiagram
    events {
        TEXT event_id PK
        INTEGER timestamp_ns
        INTEGER observed_ns
        INTEGER severity_id
        TEXT source_type
        TEXT source_id
        INTEGER template_id
        TEXT message
        TEXT entity_refs
        BLOB data
    }
    entity_events {
        TEXT entity_uuid PK
        INTEGER timestamp_ns PK
        TEXT event_id PK
    }
    alerts {
        TEXT alert_id PK
        TEXT alert_type
        INTEGER timestamp_ns
        INTEGER severity_id
        TEXT rule_name
        TEXT entity_uuid
        TEXT entity_type
        TEXT entity_value
        TEXT dedup_key UK
        INTEGER dedup_count
        REAL risk_score
        TEXT feedback
        BLOB data
    }
    model_state {
        TEXT key PK
        BLOB data
        INTEGER updated_at
    }
    graph_edges {
        TEXT source_id PK
        TEXT target_id PK
        TEXT rel_type PK
        INTEGER first_seen
        INTEGER last_seen
        INTEGER event_count
    }
    events_fts {
        TEXT message
    }

    events ||--o{ entity_events : "maps to entities"
    events ||--o{ alerts : "triggers"
    events ||--o{ graph_edges : "creates"
    events_fts ||--|| events : "indexes"
```

### Table Notes

**`events`** — Primary event store. `template_id` is `NULL` when no Drain3 template matched (sentinel `-1` is converted on write). Entity associations are stored in the `entity_events` junction table.

**`entity_events`** — Many-to-many junction between events and entities. Composite primary key `(entity_uuid, timestamp_ns, event_id)`. Used by `EntityStore.get_timeline()` for per-entity queries.

**`alerts`** — `dedup_key` has a unique index. The upsert logic increments `dedup_count` and preserves the original `timestamp_ns` when a duplicate arrives within the dedup window. Outside the window, `dedup_count` resets to 1.

**`model_state`** — Simple key-value store. Upsert-on-conflict replaces both `data` and `updated_at`.

**`graph_edges`** — Composite primary key `(source_id, target_id, rel_type)`. Upserts update `last_seen` and increment `event_count`; `first_seen` is immutable after the initial insert.

**`events_fts`** — Content-table FTS5 index backed by `events.message`. Kept in sync via `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` triggers on the `events` table.
