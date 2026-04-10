# Markov Chains

!!! example "Security: Compromised Service Account — Impossible Command Sequence"
    `svc-deploy` normally follows predictable patterns: login → pull image → start container → health check. The attacker's sequence — login → sudo → cat /etc/shadow → scp — has near-zero transition probability in the learned model. Each step is individually plausible, but the *sequence* is impossible for this entity. Score: 0.95.

!!! example "Operations: Service Restart Sequence Deviation"

    After OOM kills at T+30, `api-gateway` pods restart — but the init sequence is abnormal. The container starts the health check endpoint before the database migration completes, causing a cascade of failed readiness probes.

    ```
    EVENT  03:30:14  Pod api-gateway-7f8d9 OOMKilled (exit code 137)
    EVENT  03:30:16  Pod api-gateway-7f8d9 Pulling image api-gateway:v2.3.1
    EVENT  03:30:22  Pod api-gateway-7f8d9 Started container api-gateway
    EVENT  03:30:23  Pod api-gateway-7f8d9 Readiness probe failed: connection refused
    EVENT  03:30:24  Pod api-gateway-7f8d9 Started migration runner
    ```

    The expected restart sequence is pull → start → migrate → healthcheck. The observed sequence — start → healthcheck → migrate — means `P(healthcheck | start)` is near-zero in the learned model: healthcheck has never followed start directly. Each event is individually familiar, but the order is anomalous. Markov score: 0.88. See the [Ops Primer](../ops-primer/failure-patterns.md) for more on sequence-based failure detection.

!!! example "Interactive: Markov sequence anomaly"

    <div class="seerflow-viz"
         data-viz="detector-ts"
         data-src="../../assets/viz-data/detector-ts/markov.json"
         data-caption="Transition probability scores. A rare login to write transition at minute 180 scores above the threshold."></div>

## Theory

### Intuition

A first-order Markov chain asks: "Given the last thing that happened, how surprising is this?" It models the probability of each `template_id` following another. If `svc-deploy` always follows "pull image" with "start container", but suddenly follows "pull image" with "cat /etc/shadow", the transition probability is near zero.

Per-entity tracking is critical: what's normal for a user account is abnormal for a service account. A human developer might legitimately `sudo` occasionally — but a CI/CD service account that has only ever pulled images and started containers has no business escalating privileges. The detector maintains a separate learned transition matrix for every entity it has observed, so each entity's baseline is judged on its own history.

Unlike content-based detectors (HST) or volume-based detectors (Holt-Winters), the Markov detector is blind to *what* any single event looks like in isolation — it only cares about *order*. This makes it uniquely sensitive to behavioral sequencing attacks that blend individually normal events into an impossible narrative.

### Key Equations

**Transition probability** — the probability of template B following template A, with Laplace smoothing to handle unseen transitions:

\[
P(B \mid A) = \frac{\text{count}(A \rightarrow B) + \varepsilon}{\text{count}(A \rightarrow *) + \varepsilon \cdot |V|}
\]

**Anomaly score** — normalized negative log-probability, clamped to \([0, 1]\):

\[
\text{score} = \min\!\left(1.0, \; \frac{-\log P(B \mid A)}{-\log \varepsilon}\right)
\]

Where:

- \( A, B \) = consecutive `template_id` values for the same entity
- \( \varepsilon \) = Laplace smoothing constant (default `1e-6`)
- \( |V| \) = vocabulary size — number of distinct "from" templates seen for this entity
- \( \text{count}(A \rightarrow *) \) = total transitions out of template A
- The denominator \( -\log \varepsilon \) is the **maximum possible surprisal** — the score an entirely unseen transition would receive — which normalizes the score to \([0, 1]\)

A fully unseen transition (count = 0) yields score ≈ 1.0. A frequent, expected transition yields score ≈ 0.0. Smoothing ensures the score never literally reaches 1.0 or produces a division-by-zero error.

## Seerflow Implementation

### Configuration

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `markov_smoothing` | `float` | `1e-6` | 1e-9–0.01 | Laplace smoothing for unseen transitions. Lower values make unseen transitions score higher (closer to 1.0). |
| `markov_min_events` | `int` | `100` | 10–1000 | Minimum events per entity before scoring begins. Prevents noisy early scores when the transition matrix is sparse. |
| `markov_max_entities` | `int` | `1000` | 100–10000 | LRU cap on the number of tracked entities. When the cap is reached, the least-recently-used entity is evicted. |

### Per-Entity Tracking

Each entity gets its own `_EntityModel` instance containing:

| Field | Type | Description |
|-------|------|-------------|
| `prev_template` | `int` | The `template_id` of the most recent event for this entity (`-1` until first event) |
| `transitions` | `dict[int, dict[int, int]]` | Nested dict: `transitions[A][B]` = count of A→B transitions observed |
| `total_from` | `dict[int, int]` | `total_from[A]` = total transitions out of template A |
| `event_count` | `int` | Total events seen for this entity |

**Entity selection:** The primary entity is `entity_refs[0]`. Events with no entity references, or with `template_id == -1` (unrecognized by Drain3), return a score of `0.0` and are not learned.

**Warmup:** Score returns `0.0` until `event_count >= min_events`. This prevents anomaly noise during the initial observation period when the transition matrix contains very few counts.

### LRU Eviction

Entity models are stored in a `collections.OrderedDict` keyed by entity ID. When `max_entities` is reached, the least-recently-used entity (the leftmost entry) is evicted via `popitem(last=False)`. Each call to `score()` moves the entity to the end of the dict, refreshing its recency without creating the entity.

Note: `score()` performs a read-only lookup (no LRU promotion) — only `_get_model()` called from `learn()` moves an entity to the end. This matches the ensemble pipeline's pattern of calling `score()` before `learn()`.

### Serialization

Model state serializes to msgpack bytes via `serialize()` / `deserialize()`. The serialized payload includes:

- All hyperparameters (`smoothing`, `min_events`, `max_entities`)
- All per-entity models (transition dicts, total_from, prev_template, event_count)
- Entity insertion order is preserved (OrderedDict semantics)

Unlike the HST detector (which uses a restricted pickle unpickler), the Markov detector uses `msgspec.msgpack` for safe, schema-aware serialization with no deserialization attack surface.

### Memory Footprint

Approximately **10 KB per entity**, depending on vocabulary size. At default `max_entities = 1000`, total memory is approximately **10 MB**. Each additional unique `template_id` in the transition matrix adds roughly 80 bytes (two int keys + one int value in the nested dict).

## Practical Examples

### Security Walkthrough

`svc-deploy` has been observed for 10,000 events. Its transition matrix reflects a highly repetitive, predictable CI/CD workflow:

| From template | To template | Count | P(B \| A) |
|--------------|-------------|-------|-----------|
| login (T1) | pull image (T2) | 4,982 | ≈ 0.998 |
| pull image (T2) | start container (T3) | 4,981 | ≈ 0.998 |
| start container (T3) | health check (T4) | 4,979 | ≈ 0.997 |
| login (T1) | sudo (T99) | 0 | ≈ 1.25e-10 |

When the attacker follows login with sudo: `P(sudo | login) ≈ 1.25e-10`. Anomaly score:

\[
\text{score} = \min\!\left(1.0,\; \frac{-\log(1.25 \times 10^{-10})}{-\log(10^{-6})}\right) \approx \frac{22.8}{13.8} \approx \min(1.0, 1.65) = \mathbf{0.95}
\]

Sample detector output:

```json
{
  "detector": "markov",
  "score": 0.95,
  "entity": "svc-deploy",
  "prev_template_id": 1,
  "curr_template_id": 99,
  "prev_template_label": "Accepted password for * from * port *",
  "curr_template_label": "sudo: * : TTY=* ; PWD=* ; USER=root ; COMMAND=*",
  "transition_count": 0,
  "transition_probability": 1.25e-10,
  "interpretation": "Near-zero sequence probability — this transition has never been observed for this entity"
}
```

### Ops Walkthrough

`api-gateway` restarts normally follow pull → start → migrate → healthcheck. After the OOM kill, the container starts health checking before migration completes. The transition `start → healthcheck` has count 0 in the learned model (healthcheck has never directly followed start — migrate always comes first).

`P(healthcheck | start) ≈ 1.25e-10`. Score ≈ **0.88**, firing well before the cascade of readiness probe failures produces volume-level signals in Holt-Winters or CUSUM.

## Tuning Guide

### When to Adjust

- **False positives from new entities:** New entities start with empty transition matrices and reach `min_events` before scoring begins, but early counts may still be sparse. Increase `min_events` to 200 to require a more populated baseline before the detector fires.

- **Missing sequence anomalies (novel transitions scoring too low):** Decrease `markov_smoothing` to `1e-9`. Lower smoothing increases the surprisal of unseen transitions, pushing scores closer to 1.0 for events the entity has never performed.

- **High memory usage:** Decrease `max_entities` to 500. Entities with infrequent access will be evicted sooner. For deployments with a large number of ephemeral entities (short-lived containers, transient sessions), consider a smaller cap combined with a higher `min_events` so that ephemeral entities are unlikely to reach the scoring threshold before eviction.

### Sensitivity Tradeoffs

| Smoothing | Unseen transition score | Best For |
|-----------|------------------------|----------|
| `1e-9` | ≈ 1.0 | High-security environments; maximum sensitivity to novel sequences |
| `1e-6` (default) | ≈ 0.95 | Balanced — catches rare transitions, tolerates minor vocabulary gaps |
| `1e-3` | ≈ 0.5 | Noisy environments with frequent template vocabulary churn |

### Common Patterns

- **Service accounts with predictable workflows:** The Markov detector is most powerful here. A service account with 10,000 events and 5 distinct templates will have near-certainty for observed transitions and near-zero probability for anything else.
- **Human users with variable workflows:** Increase `min_events` (e.g., 500) and smoothing (e.g., `1e-4`). Human behavior is more varied; a lower smoothing value will generate false positives as users explore less common but legitimate paths.
- **Ephemeral entities (pods, containers):** These rarely accumulate enough events to clear `min_events`. The detector naturally skips them. If sequence anomalies in ephemeral entities are important, reduce `min_events` and accept more noisy early scores.
- **Post-deployment template shifts:** New software versions often introduce new `template_id` values. The Markov detector will score new templates as anomalous until their transitions are learned. This is expected — use HST's novelty signal for the initial burst, and allow Markov to catch sequence deviations once the new templates are established.

---

## See Also

- [Anomaly Detection concepts](../security-primer/anomaly-detection.md)
- [Ensemble overview](index.md)
- [Half-Space Trees (HST)](hst.md)
- [Holt-Winters](holt-winters.md)
- [CUSUM](cusum.md)
- [Scoring & Attack Mapping](scoring.md)
- [Configuration Reference](../reference/config.md)

**Next:** [DSPOT →](dspot.md) — adaptive thresholds via Extreme Value Theory and GPD tail fitting.
