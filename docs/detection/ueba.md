# UEBA — User & Entity Behaviour Analytics

The UEBA engine scores each event against the **individual entity's
own historical baseline** — not against a population norm. The intent
is to catch behaviour that is unusual *for this user* (or host, IP,
service account), even if it would look unremarkable across the fleet.

UEBA runs alongside the [content-based detection
ensemble](index.md): the two ask different questions and surface
different alerts.

| | Ensemble (HST, HW, CUSUM, Markov) | UEBA |
|---|---|---|
| Baseline scope | Global, per source/template | Per entity |
| Signal | Event content novelty + volume | Behavioural deviation |
| Cold start | Minutes | Days (see warmup) |
| Cost | O(1) per event | O(1) per event |

## Sub-scores

Each event yields a blended score from four sub-scores. Weights are
configured under
[`ueba.sub_score_weights`](../reference/config.md#ueba) and must sum
to `1.0`.

| Sub-score | Question | Default weight |
|-----------|----------|---------------|
| `time_of_day` | Is this hour-of-day rare for this entity? | `0.25` |
| `source_novelty` | Is this source IP / network novel for this entity? | `0.30` |
| `volume` | Is this event count well above the entity's volume EMA? | `0.20` |
| `pattern_novelty` | Is this Drain3 template rare for this entity? | `0.25` |

The blended score is fed into a **per-entity-type DSPOT threshold**
(default `0.0001` risk level) so threshold calibration adapts to each
entity type's natural variance instead of a hard-coded cutoff.

### Time-of-day

Buckets are 1-hour UTC. The score is `0` when the current hour is in
the entity's observed set, growing as the entity drifts away from
that set.

### Source novelty

The entity tracks its top-K distinct source IPs
(`ueba.source_ip_cap`, default 64). New IPs outside the set score
high; familiar IPs score `0`.

### Volume

The entity maintains a per-minute volume EMA
(`ueba.ema_alpha`, default `0.05`). The score is a smooth function of
the current bucket's z-score against the EMA.

### Pattern novelty

The entity tracks its top-K Drain3 templates
(`ueba.template_top_k`, default 32) with an LFU weight. Rare or
unseen templates score high.

## Lifecycle

1. **Warmup.** For a new entity, UEBA accumulates events without
   scoring until both:
   - `ueba.warmup_days` have elapsed since the entity's first event, **and**
   - `ueba.warmup_min_events` events have been seen.

   During warmup, `GET /api/v1/entities/{uuid}/baseline` returns
   `404` with `status: warming_up`.

2. **Scoring.** Each subsequent event is scored. If the blended score
   exceeds the entity-type DSPOT threshold, an alert is generated
   (subject to per-entity cooldown).

3. **Cooldown.** After an alert, the entity is suppressed for
   `ueba.alert_cooldown_seconds` (default 900 s) to avoid alert
   storms during a single incident.

4. **Eviction.** When the active entity set exceeds
   `ueba.max_entities` (default 100 000), an LRU sweep evicts cold
   entities.

5. **Persistence.** Baselines are flushed to the configured
   `ModelStore` on the same cadence as the rest of the detection
   ensemble (`detection.model_save_interval_seconds`) and restored on
   restart.

## Reading the baseline

The dashboard's **Entity Explorer** surfaces the current baseline.
Programmatically:

```bash
curl -s http://localhost:8080/api/v1/entities/$UUID/baseline | jq
```

Returns:

```json
{
  "entity_uuid": "...",
  "first_seen_ns": 1731000000000000000,
  "event_count": 4231,
  "hours_active": [9, 10, 11, 14, 15, 16, 17],
  "top_source_ips": ["10.0.1.42", "10.0.1.7", "..."],
  "top_templates": [
    { "template_id": "abc1234", "weight": 0.42 },
    { "template_id": "def5678", "weight": 0.18 }
  ],
  "volume_ema_minute": 3.7,
  "warming_up": false
}
```

## Tuning

| Symptom | Adjustment |
|---------|-----------|
| Too many low-signal UEBA alerts on first-week traffic | Increase `warmup_days` or `warmup_min_events`. |
| Late-night ops triggers `time_of_day` noise | Reduce `sub_score_weights.time_of_day`; rebalance into `source_novelty` or `pattern_novelty`. |
| Service accounts with massive template churn drown the signal | Reduce `template_top_k` or rebalance `sub_score_weights.pattern_novelty`. |
| Mid-incident alert storm | Increase `alert_cooldown_seconds`. |
| Memory pressure on a large fleet | Reduce `max_entities` and `source_ip_cap`. |

## Disabling

Set `ueba.enabled: false`. The rest of the pipeline is unaffected and
no UEBA alerts will be produced. Baseline storage is retained so
re-enabling does not trigger a fresh warmup.

## Configuration reference

See [Config Reference → UEBA](../reference/config.md#ueba) for the
full key/default table.
