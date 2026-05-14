# Graph Backends

The entity graph can be persisted to one of three backends. The
selection is a single config knob ([`storage.graph_backend`](../reference/config.md#storage));
all higher-level code (correlation engine, graph algorithms, dashboard)
is backend-agnostic.

| Backend | Process model | Persistence | Best for |
|---------|---------------|-------------|----------|
| `igraph` (default) | In-process | Periodic snapshot to disk | Single-host deployments, dev / test, < 5 M edges. |
| `falkordb` | External Redis-based service | Native | Multi-instance / clustered deployments, hot read paths. |
| `postgres_age` | External PostgreSQL + Apache AGE | Native, transactional | When you already operate Postgres and want graph + relational in one place. |

`igraph` is the zero-config default and matches the in-memory graph
described in [Construction](construction.md) and
[Algorithms](algorithms.md). The other two trade startup cost for
durability and concurrency.

## Picking a backend

| Question | If yes, lean toward |
|----------|--------------------|
| Single Seerflow process? | `igraph` |
| Multiple Seerflow instances need to share one graph? | `falkordb` or `postgres_age` |
| Already running Redis for caching? | `falkordb` |
| Already running Postgres and want one operational dependency? | `postgres_age` |
| Need transactional consistency between graph writes and SQL state? | `postgres_age` |
| Read-heavy analytical workloads (PageRank, Louvain) at scale? | `falkordb` (in-memory) |

## `igraph` (default)

In-process graph using the `python-igraph` library.

```yaml
storage:
  graph_backend: igraph    # default — can be omitted
```

- Storage: writes a snapshot file under `storage.data_dir` on the
  same cadence as the model store. No additional service to operate.
- Throughput: ~100 K – 500 K edge writes/s on a single host (CPU-bound
  on hashing).
- Limits: bounded by process memory; igraph's 32 bytes/edge gives
  ~30 M edges in 1 GB.

## `falkordb`

Redis-backed graph (`falkordb` fork). Connect via a URL — credentials
embedded in the URL are redacted from logs and `repr`.

```yaml
storage:
  graph_backend: falkordb
  falkordb_url: redis://falkordb.internal:6379/0
```

Operational notes:

- Run a dedicated FalkorDB instance — do not mix on a Redis cache
  shared with other workloads.
- Set `maxmemory-policy noeviction`; eviction policies would silently
  drop graph nodes.
- For HA, run FalkorDB with Sentinel or in a managed environment that
  preserves the dataset on failover.

Connection pool is shared with the broader async runtime; no extra
tuning needed unless you observe head-of-line blocking under heavy
read load.

## `postgres_age`

Apache AGE inside PostgreSQL. Reuses
[`storage.postgresql_url`](../reference/config.md#storage) and the
asyncpg pool — no separate connection settings.

```yaml
storage:
  backend: postgresql
  postgresql_url: ${DATABASE_URL}
  postgresql_pool_min_size: 4
  postgresql_pool_max_size: 32
  graph_backend: postgres_age
```

Operational notes:

- The AGE extension must be installed and loaded in the target
  Postgres instance. Seerflow does not install the extension for you.
- The first startup creates the graph schema (one-time DDL).
- Long-running graph traversals share the same pool as event writes
  — size `postgresql_pool_max_size` accordingly.

## Migrating between backends

Use [`seerflow graph migrate`](../reference/cli.md#seerflow-graph) to
move an existing graph between backends without downtime on the
ingest pipeline (writes during migration are replayed at the end of
the stream).

```bash
# Dry-run estimate
seerflow graph migrate --from igraph --to falkordb --dry-run

# Hot migration
seerflow graph migrate --from igraph --to falkordb \
                       --batch-size 10000 --wipe-destination
```

Procedure:

1. Run with `--dry-run` first — it reports projected vertex / edge
   counts and surfaces backend-specific incompatibilities before the
   write phase.
2. Run for real with `--wipe-destination` for a strict count-equality
   check. Omit it to merge into an existing destination graph.
3. Flip `storage.graph_backend` in `seerflow.yaml`.
4. Restart Seerflow.

## Failure handling

| Scenario | Behaviour |
|----------|----------|
| Backend unreachable on startup | Seerflow refuses to start (fail-fast) — degraded operation on a stale graph would be worse than no graph. |
| Backend drops mid-run | Writes are buffered briefly; on extended outage the pipeline halts with a `503` on graph-dependent endpoints. |
| Read query times out | Graph-structural correlation skips the affected entity for that scoring window; ingest continues. |

## Storage-side trade-offs

| | `igraph` | `falkordb` | `postgres_age` |
|---|---|---|---|
| Operational dependencies | None | FalkorDB service | Postgres + AGE extension |
| Crash-safe | Snapshot + WAL replay | Yes | Yes (transactional) |
| Shared between Seerflow instances | No | Yes | Yes |
| Algorithm latency (PageRank, M edges) | Lowest | Low | Medium |
| Best edge throughput | High | Medium | Low (Postgres overhead) |
| Suited to ad-hoc Cypher exploration | No (Python API only) | Yes | Yes |

For algorithm details, see [Algorithms & Detection](algorithms.md).
