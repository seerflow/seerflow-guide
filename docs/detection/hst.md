# Half-Space Trees (HST)

!!! example "Security: Compromised Service Account — Novel SSH Patterns"
    The `svc-deploy` account has never used SSH. When the attacker uses the stolen credential to SSH into `dev-host-1`, HST sees template_ids and feature combinations with no historical precedent. The event lands in a sparse region of feature space — producing a high anomaly score (0.87) even though it's a single event.

!!! example "Operations: Novel Error Patterns After Deployment"

    After deploying v2.3.1 of `api-gateway`, HST detects a spike in 500 errors with stack traces never seen before — a new error cluster outside the training baseline.

    ```json
    {"timestamp": "2026-04-08T03:12:47Z", "service": "api-gateway", "level": "ERROR",
     "status": 500, "path": "/api/orders", "duration_ms": 12340,
     "error": "NullPointerException in OrderService.validate(OrderService.java:142)"}
    {"timestamp": "2026-04-08T03:12:48Z", "service": "api-gateway", "level": "ERROR",
     "status": 500, "path": "/api/orders/batch", "duration_ms": 15200,
     "error": "NullPointerException in OrderService.validate(OrderService.java:142)"}
    ```

    Drain3 assigns template ID 312 to this new stack trace pattern. Because template 312 has **zero mass** in the HST model — no event with `tid_312` has ever been seen — the leaf it lands in has a count of 0. The feature vector `{tid_312: 1.0, entity_count: 0.0, severity: 9.0, param_count: 1.0, msg_length: 73.0}` falls into a completely empty region of feature space. The HST returns a score of **0.91**, even though only two events have arrived. Novelty alone drives the score — not volume.

    See the [Ops Primer](../ops-primer/failure-patterns.md) for more failure pattern examples.

!!! example "Interactive: HST on a real event stream"

    Half-Space Trees score over 4 hours. Baseline noise stays around 0.3; a novel template at minute 180 crosses the 0.75 threshold and triggers an anomaly.

    <div class="seerflow-viz"
         data-viz="detector-ts"
         data-src="../../assets/viz-data/detector-ts/hst.json"></div>

## Theory

### Intuition

Normal events cluster together in feature space. HST randomly partitions the space into boxes using half-space cuts — at each node, a feature and a threshold are chosen at random, splitting events into two halves. Each leaf tracks how many events have fallen in that region (the "mass"). When a new event arrives, it falls into some leaf — if that leaf has low mass, the event is in a sparse or novel region and scores as anomalous. A brand-new template ID that has never appeared before lands in a leaf with zero historical mass, producing the highest possible anomaly score regardless of how many other features look ordinary.

The streaming window ensures the model forgets old patterns and adapts to drift. Unlike batch isolation forests, HST maintains two mass profiles — a reference and a latest — and scores based on the ratio. The reference window captures the historical baseline, while the latest window tracks recent data. As patterns change over time (new services are deployed, traffic profiles shift), the reference window rolls forward, allowing the model to treat previously novel patterns as normal once they have been observed enough times.

### Key Equations

**Mass profile** — the proportion of historical events that fell into the same leaf as event \(x\):

\[
m(x) = \frac{\text{count of events in leaf}(x)}{\text{window\_size}}
\]

**Anomaly score per tree** — how much of the mass belongs to the reference (historical) profile versus the latest (recent) profile. A high reference mass with low latest mass means the event pattern was common historically but has stopped appearing — the inverse is novelty:

\[
s_k(x) = \frac{m_{\text{ref},k}(x)}{m_{\text{ref},k}(x) + m_{\text{latest},k}(x)}
\]

**Final ensemble score** — averaged across all trees and clamped to \([0, 1]\):

\[
S(x) = \frac{1}{T} \sum_{k=1}^{T} s_k(x), \quad \text{clamped to } [0, 1]
\]

Where:

- \( T \) = number of trees (default 25)
- \( m_{\text{ref}} \) = reference mass profile (historical baseline)
- \( m_{\text{latest}} \) = latest window mass profile (recent data)
- **High score** = event in sparse region = anomalous

## Seerflow Implementation

### Configuration

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `hst_n_trees` | `int` | `25` | 1–100 | Number of independent half-space trees. More trees produce more stable, averaged scores at the cost of additional memory. |
| `hst_window_size` | `int` | `1000` | 100–10000 | Sliding window size. Larger windows adapt more slowly to drift and produce fewer false positives on stable data. |

Internal constant: `_HST_HEIGHT = 8` (tree depth — not configurable).

### Feature Extraction

The `_extract_features()` function produces a 5-dimensional feature vector from each `SeerflowEvent`:

| Feature | Description | Example Value |
|---------|-------------|---------------|
| `tid_{template_id}` | One-hot encoding of the Drain3 template ID assigned to this log line | `1.0` |
| `entity_count` | Total number of related entities: `len(related_ips) + len(related_users) + len(related_hosts)` | `3.0` |
| `severity` | Numeric severity level (1–24, OpenTelemetry scale) derived from `severity_id.value` | `6.0` |
| `param_count` | Number of variable parameters extracted by Drain3 from this log line | `2.0` |
| `msg_length` | Character length of the raw log message | `142.0` |

The `tid_` prefix means each unique template gets its own dimension. An event with `template_id=847` contributes `{tid_847: 1.0}` — all other `tid_*` dimensions are absent (treated as 0.0 by River's sparse dict representation).

### Scoring Logic

`score(event)` calls `score_one(features)` on the underlying River model, returning a float in `[0, 1]`. The raw River output is clamped via `max(0.0, min(1.0, raw))` to handle any edge-case floating point values outside range.

After scoring, `learn(event)` calls `learn_one(features)` to update the model incrementally. Scoring and learning are always separate calls — the ensemble pipeline scores first, then learns, ensuring the score reflects the pre-update model state.

### Warmup and Memory

HST requires **no warmup period** — it scores from the very first event. Early scores are noisier because the model is sparse (everything appears novel when the model has seen few events). Scores stabilize as the window fills, typically after around 1000 events. After warmup, normal recurring patterns settle into low-score regions while genuinely novel patterns remain high.

Memory footprint: approximately **50 KB per instance** (25 trees × height 8, storing integer mass counts at each leaf).

### Serialization

Model checkpoints use `pickle` for River's internal tree structures. To prevent deserialization attacks if a checkpoint file is tampered with, Seerflow uses `_HSTUnpickler` — a restricted `pickle.Unpickler` subclass that overrides `find_class` and refuses to instantiate any class not in the explicit allowlist:

```python
_HST_ALLOWED_CLASSES: frozenset[tuple[str, str]] = frozenset({
    ("builtins", "tuple"),
    ("collections", "defaultdict"),
    ("functools", "partial"),
    ("random", "Random"),
    ("river.anomaly.hst", "HSTBranch"),
    ("river.anomaly.hst", "HSTLeaf"),
    ("river.anomaly.hst", "HalfSpaceTrees"),
})
```

Any attempt to deserialize a payload containing other classes — including `os.system`, `subprocess.Popen`, or any custom exploit class — raises `pickle.UnpicklingError` immediately. After loading, the result is also type-checked to confirm it is a `HalfSpaceTrees` instance before being assigned to `self._model`.

### Source References

- Source: [`src/seerflow/detection/hst.py`](https://github.com/seerflow/seerflow)
- River docs: [HalfSpaceTrees](https://riverml.xyz/latest/api/anomaly/HalfSpaceTrees/)

## Practical Examples

### Security Walkthrough

A threat actor obtains the `svc-deploy` service account credentials via a phishing attack and attempts lateral movement via SSH.

1. `svc-deploy` normally produces deployment events: template IDs 101–105 (deployment start, artifact pull, health check, etc.)
2. The attacker SSHes into `dev-host-1` using the stolen credential → Drain3 assigns **template ID 847** (SSH key exchange negotiation pattern)
3. The feature vector for this event:

    ```python
    {
        "tid_847": 1.0,       # novel template — zero mass
        "entity_count": 3.0,  # svc-deploy + dev-host-1 + attacker IP
        "severity": 6.0,      # INFO level (SSH connection established)
        "param_count": 2.0,   # e.g. cipher suite + session ID
        "msg_length": 142.0   # raw log line length
    }
    ```

4. Template 847 has **zero mass** across all 25 HST trees → anomaly score: **0.87**

Sample detector output:

```json
{
  "detector": "hst",
  "score": 0.87,
  "source_type": "auth-service",
  "template_id": 847,
  "features": {
    "tid_847": 1.0,
    "entity_count": 3.0,
    "severity": 6.0,
    "param_count": 2.0,
    "msg_length": 142.0
  },
  "interpretation": "Novel event pattern — no historical precedent for this template/feature combination"
}
```

### Ops Walkthrough

The `api-gateway` service is deployed at version 2.3.1. A regression in `OrderService.validate()` causes unhandled `NullPointerException` errors on certain request shapes.

1. `api-gateway` normally produces request/response templates (IDs 1–20)
2. After the v2.3.1 deploy, `NullPointerException` stack traces appear → Drain3 assigns **template ID 312**
3. Feature vector: `{tid_312: 1.0, entity_count: 0.0, severity: 9.0, param_count: 1.0, msg_length: 73.0}`
4. Zero mass across all trees → score: **0.91**
5. Even at low volume (2 events/min), **novelty drives the score** — there is no volume threshold to cross

The score remains high until the window absorbs enough of the new template. In a real incident, the alert fires within seconds of the first novel error, before the error rate has climbed enough to trigger threshold-based monitors.

### What the Operator Sees

The HST score feeds into the ensemble blended score alongside Holt-Winters and CUSUM. A sample alert showing the HST contribution:

```json
{
  "alert_id": "alert-20260408-003",
  "timestamp": "2026-04-08T03:12:47Z",
  "source_type": "api-gateway",
  "entity": "api-gateway",
  "ensemble_score": 0.83,
  "detector_scores": {
    "hst": 0.91,
    "holtwinters": 0.42,
    "cusum": 0.38
  },
  "dominant_signal": "hst",
  "template_id": 312,
  "message": "NullPointerException in OrderService.validate(OrderService.java:142)",
  "mitre_tactic": null,
  "risk_score": 0.83,
  "suggested_action": "Investigate novel log template — possible regression or new code path"
}
```

The `dominant_signal: "hst"` field indicates that content novelty (not volume or trend) was the primary driver. This is the expected signature of a post-deploy regression or a novel attacker technique.

## Tuning Guide

### When to Adjust

- **High false positives on stable data:** Increase `hst_window_size` (e.g., 5000). A larger window means the model has seen more examples of each pattern and treats them as normal faster.
- **Missing novel threats:** Decrease `hst_window_size` (e.g., 500). A smaller window stays sensitive to novelty longer and adapts more slowly to emerging patterns.
- **Unstable, jittery scores:** Increase `hst_n_trees` (e.g., 50). More trees average out the random variation in individual tree cuts.

### Sensitivity Tradeoffs

| Window Size | Sensitivity | False Positives | Best For |
|-------------|-------------|-----------------|----------|
| 500 | High | Higher | Security-first environments; catch novel patterns as quickly as possible |
| 1000 (default) | Balanced | Moderate | General-purpose log monitoring |
| 2000–5000 | Lower | Fewer | Noisy environments with high template diversity (e.g., mixed-source ingestion) |

### Common Patterns

- **Noisy environments** (many services, diverse log formats): use a larger window (2000–5000). High template diversity means many low-mass events that are actually normal.
- **Security-first deployments**: use a smaller window (500). The goal is to catch novel attacker techniques as early as possible, even at the cost of more alerts.
- **Low-traffic sources** (e.g., batch jobs, scheduled tasks): the default 1000 works well. Low event rates mean the window fills slowly; a very small window would cause excessive sensitivity.
- **After a major deployment**: expect a brief burst of high HST scores as new templates enter the model. This is expected behavior — scores will normalize as the window absorbs the new patterns within a few thousand events.

---

## See Also

- [Anomaly Detection concepts](../security-primer/anomaly-detection.md)
- [Ensemble overview](index.md)
- [Scoring & Attack Mapping](scoring.md)
- [Configuration Reference](../reference/config.md)

**Next:** [Holt-Winters →](holt-winters.md) — seasonal volume anomaly detection via triple exponential smoothing.
