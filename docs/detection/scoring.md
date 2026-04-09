# Scoring & Attack Mapping

!!! example "Security: Compromised Service Account — Scenario Resolution"
    The `svc-deploy` attack resolves: HST scores 0.87 (novel SSH), Holt-Winters scores 1.0 (3 AM volume spike), CUSUM scores 0.6 (auth failure rate shift), Markov scores 0.95 (impossible command sequence). After z-normalization, weighted blending, and signal amplification (3/4 detectors converging → 2x boost), the blended score is 4.8 — well above DSPOT's threshold of 3.2. MITRE mapping adds: T1021.004 (SSH), T1003.008 (/etc/shadow access).

!!! example "Operations: Memory Leak Cascade — Scenario Resolution"
    All 4 detectors fire: HST 0.91, Holt-Winters 1.0, CUSUM 1.0, Markov 0.88. With 4/4 convergence the blended score receives 2x amplification → final score 5.1, exceeding DSPOT's 2.8 threshold. No ATT&CK mapping (operational scenario, not an attack).

## Blended Scoring

Each individual detector — HST, Holt-Winters, CUSUM, Markov — produces a raw score for its specific signal type. These four raw scores are combined into a single blended score via a three-step pipeline: normalize, weight, and amplify. The blended score then feeds into DSPOT's adaptive threshold to determine whether an anomaly alert fires.

### How Scores Are Combined

```mermaid
flowchart LR
    RS[Raw Scores] --> ZN[Z-Score\nNormalization]
    ZN --> WA[Weighted\nAverage]
    WA --> SA[Signal\nAmplification]
    SA --> FS[Final Score]
```

### Step 1: Z-Score Normalization

Raw detector scores are not directly comparable — HST produces scores in [0, 1], Holt-Winters can produce values in [0, ∞), CUSUM accumulates over time, and Markov scores are log-probabilities. Normalizing each raw score into z-score space puts all detectors on the same scale before blending.

Each detector × source combination has its own Welford online accumulator tracking running mean and standard deviation. For detector \( i \) with raw score \( s_i \):

\[
z_i = \frac{s_i - \bar{s}_i}{\sigma_i}
\]

Where \( \bar{s}_i \) and \( \sigma_i \) are the running mean and standard deviation maintained by Welford's algorithm. Normalization happens **before** the current score is added to the accumulator — score first, then learn:

```python
# From ensemble.py — compute z BEFORE updating accumulator
acc = windows[i]
if acc._n >= 2:
    std = max(acc.stdev(), 1e-10)
    z_scores.append((raw - acc.mean()) / std)
else:
    z_scores.append(raw)   # raw during warmup (n < 2)
acc.update(raw)            # update AFTER normalization
```

**Warmup handling:** when a detector has seen fewer than 2 observations (accumulator `n < 2`), its z-score is unavailable and represented as `NaN`. NaN channels are treated as inactive and skipped in the weighted average — they do not dilute the combined score during warmup. Only `±inf` values from unexpected overflow are clamped to `0.0` before entering the pipeline.

**Welford's algorithm** maintains numerically stable running statistics in O(1) per update without storing the full score history:

\[
\bar{s}_{n} = \bar{s}_{n-1} + \frac{s_n - \bar{s}_{n-1}}{n}, \quad
M_2^{(n)} = M_2^{(n-1)} + (s_n - \bar{s}_{n-1})(s_n - \bar{s}_n)
\]

\[
\sigma_n = \sqrt{\frac{M_2^{(n)}}{n - 1}}
\]

One accumulator instance per detector per log source ensures that normalization is always relative to that source's own historical distribution — an SSH service and a web API do not share the same baseline.

### Step 2: Weighted Average

The z-normalized scores are combined using a weighted average over active detectors (those not in warmup):

\[
\text{combined} = \frac{\sum_{i \in \text{active}} w_i \cdot z_i}{\sum_{i \in \text{active}} w_i}
\]

Active means the channel is not NaN — i.e., the accumulator has seen at least 2 observations. The formula divides by the sum of **active** weights, not the sum of all weights, so partially warmed-up ensembles still produce calibrated scores rather than being artificially suppressed.

Default weights reflect the relative signal strength of each detector type:

| Config Key | Detector | Default | Rationale |
|---|---|---|---|
| `weights_content` | HST | 0.30 | Content novelty — highest weight, catches novel threats and new error patterns |
| `weights_volume` | Holt-Winters | 0.25 | Volume anomaly — seasonal spikes and traffic bursts |
| `weights_sequence` | Markov | 0.25 | Sequence anomaly — impossible command or event-type transitions |
| `weights_pattern` | CUSUM | 0.20 | Change-point detection — sustained rate shifts |

Weights do not need to sum to 1.0. The formula normalizes by the active weight sum, so adding or removing a detector does not require rebalancing the remaining weights.

### Step 3: Signal Amplification

After weighting, the combined score is amplified when multiple detectors independently converge on an anomaly. A detector is considered **converging** when its z-score exceeds 1.0 (above one standard deviation from its own baseline).

Amplification rules scale relative to the number of active detectors, using integer thresholds that adjust as detectors warm up:

- **≥ 2/3 of active detectors converging** (minimum 2): combined score × **2.0**
- **≥ 1/2 of active detectors converging** (minimum 2): combined score × **1.5**
- **Otherwise:** no boost — score is used as-is

```python
# From ensemble.py — signal amplification
active_z = [z for z in z_scores if not math.isnan(z)]
n_signals = len(active_z)
converging = sum(1 for z in active_z if z > 1.0)
if converging >= max(n_signals * 2 // 3, 2):
    combined *= 2.0
elif converging >= max(n_signals // 2, 2):
    combined *= 1.5
```

This is the key ensemble insight: **individual detector noise stays at 1×; real anomalies that trigger multiple detectors get amplified.** A one-detector false positive remains at its normalized score. An attacker whose behavior triggers HST (novel SSH), Markov (impossible sequence), and Holt-Winters (off-hours volume spike) simultaneously receives the full 2× amplification — pushing the combined score well above the DSPOT threshold.

The minimum of 2 converging detectors prevents amplification from triggering when only a single active detector is present (e.g. during the warmup phase when most channels are still NaN).

## MITRE ATT&CK Mapping

### How It Works

ATT&CK mapping runs after scoring, adding threat intelligence context to detected anomalies without affecting the score itself. The `AttackMapper` holds a list of compiled regex patterns, each annotated with one or more ATT&CK tactics and techniques. When an anomaly fires, the Drain3 log template string for the triggering event is matched against this list. The first matching pattern wins — all its tactics and techniques are attached to the event's annotations.

Patterns are compiled case-insensitively (`re.IGNORECASE`) and matched via `pattern.search(template)` — the match can appear anywhere in the template string, not just at the start.

```python
# From attack_mapping.py — first-match lookup
def lookup(self, template: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    for mapping in self._mappings:
        if mapping.pattern.search(template):
            return mapping.tactics, mapping.techniques
    return (), ()
```

The mapper is initialized with two sources merged in order: the bundled `default_attack_mappings.yaml` (loaded via `importlib.resources`), followed by any custom mappings from `seerflow.yaml`. Because first match wins, custom mappings provided earlier in the list take precedence over defaults.

### Default Mapping Patterns

The bundled defaults cover the most common log template patterns:

| Pattern | Tactics | Techniques |
|---|---|---|
| `authentication.*fail`, `login.*fail`, `invalid.*password` | credential-access, initial-access | T1110, T1078 |
| `ssh.*(?:error\|fail\|disconnect)`, `sshd.*fail` | credential-access, initial-access | T1110, T1078 |
| `sudo.*incorrect`, `su.*authentication failure` | privilege-escalation | T1548 |
| `segfault`, `core dump`, `SIGSEGV`, `SIGBUS` | execution | T1203 |
| `permission denied`, `access denied`, `403 Forbidden` | defense-evasion | T1222 |
| `account.*lock`, `too many.*attempt`, `brute.?force` | credential-access | T1110 |

### Example Mapping Entry

```yaml
- pattern: "ssh.*key.*exchange"
  tactic: "lateral-movement"
  technique: "T1021.004"
  technique_name: "Remote Services: SSH"
```

In the YAML, a single entry maps one pattern to one or more tactics and techniques (as lists). The `technique_name` field is for human readability and is not used programmatically.

### Custom Mappings

Add organization-specific mappings via `attack_mappings` in `seerflow.yaml`. Custom entries are appended to the defaults and matched in list order — put higher-priority patterns first:

```yaml
detection:
  attack_mappings:
    - pattern: "privilege.*escalat|setuid|chmod.*[u+s]"
      tactics: ["privilege-escalation"]
      techniques: ["T1548.001"]
    - pattern: "/etc/shadow|/etc/passwd.*write"
      tactics: ["credential-access"]
      techniques: ["T1003.008"]
    - pattern: "cron.*added|at.*job.*schedul"
      tactics: ["persistence"]
      techniques: ["T1053.003"]
```

Pattern length is capped at 500 characters. Invalid regex raises `ValueError` at startup — misconfigured patterns are caught before any traffic is processed.

## Practical Examples

### Security Scenario: `svc-deploy` Lateral Movement

**Step 1 — Raw detector scores:**

| Detector | Raw Score | Signal |
|---|---|---|
| HST | 0.87 | Novel SSH template — zero prior mass |
| Holt-Winters | 1.0 | 3 AM volume spike — 4× seasonal expectation |
| CUSUM | 0.6 | Auth failure rate shift — CUSUM crossed h |
| Markov | 0.95 | svc-deploy executing interactive shell — near-zero transition probability |

**Step 2 — Z-normalization** (per accumulator, after 300+ prior events):

| Detector | z-score |
|---|---|
| HST_z | 3.1 |
| Holt-Winters_z | 4.2 |
| CUSUM_z | 2.1 |
| Markov_z | 3.8 |

**Step 3 — Weighted average** (all 4 active, weights sum to 1.0):

\[
\text{combined} = \frac{3.1 \times 0.30 + 4.2 \times 0.25 + 2.1 \times 0.20 + 3.8 \times 0.25}{1.0} = \frac{0.93 + 1.05 + 0.42 + 0.95}{1.0} = 3.35
\]

**Step 4 — Signal amplification** (3 of 4 detectors have z > 1.0 → ≥ 2/3 → 2× boost):

\[
\text{final} = 3.35 \times 2.0 = 6.70
\]

**Step 5 — DSPOT decision:** 6.70 > 3.2 (upper z_q) → **ANOMALY**

**Step 6 — ATT&CK mapping:**

The Drain3 template for the SSH key exchange log matches `ssh.*key.*exchange` → lateral-movement, T1021.004. The `/etc/shadow` access log matches `/etc/shadow` → credential-access, T1003.008. Both annotations are attached to the alert.

```json
{
  "is_anomaly": true,
  "score": 6.70,
  "upper_threshold": 3.2,
  "anomaly_direction": "upper",
  "attack_tactics": ["lateral-movement", "credential-access"],
  "attack_techniques": ["T1021.004", "T1003.008"]
}
```

### Operations Scenario: Memory Leak Cascade

**Step 1 — Raw scores:** HST 0.91 (new OOM error templates), Holt-Winters 1.0 (memory metric 3× above seasonal), CUSUM 1.0 (allocation rate crossed h), Markov 0.88 (GC-heavy sequence never seen in this service).

**Step 2 — Z-normalized:** HST_z 3.4, HW_z 4.8, CUSUM_z 4.1, Markov_z 3.2.

**Step 3 — Weighted average:**

\[
\text{combined} = 3.4 \times 0.30 + 4.8 \times 0.25 + 4.1 \times 0.20 + 3.2 \times 0.25 = 1.02 + 1.20 + 0.82 + 0.80 = 3.84
\]

**Step 4 — Amplification:** 4/4 detectors converging → ≥ 2/3 → 2× → **final = 7.68**

**Step 5 — DSPOT:** 7.68 > 2.8 → **ANOMALY**

**Step 6 — ATT&CK:** No template matches operational patterns → empty tactics/techniques. The alert fires as a pure operational anomaly with no threat intelligence annotation.

## Tuning Guide

### Adjusting Detector Weights

Weights shift the relative influence of each detector type on the combined score. Increase a weight to make the ensemble more sensitive to that signal type; the formula re-normalizes automatically.

| Goal | Adjustment | Effect |
|---|---|---|
| Security-first deployment | Raise `weights_content` to 0.40, `weights_sequence` to 0.35 | Novel templates and impossible command sequences dominate |
| Infrastructure monitoring | Raise `weights_volume` to 0.40, `weights_pattern` to 0.30 | Volume spikes and rate shifts dominate |
| Reduce noise from volume spikes | Lower `weights_volume` to 0.10 | Traffic bursts weigh less; content novelty drives alerts |
| Even ensemble | Set all weights to 0.25 | No detector type has structural advantage |

### Understanding Amplification

Amplification only triggers when **at least 2** detectors independently flag an anomaly (z > 1.0). This guards against single-detector noise causing outsized blended scores:

- **1 detector firing, 3 silent:** no boost — combined score reflects only the one signal
- **2 of 4 detectors firing:** 1.5× — moderate confidence, corroborated signal
- **3 of 4 detectors firing:** 2× — high confidence, cross-modal convergence
- **4 of 4 detectors firing:** 2× — maximum confidence, all signals agree

The 2.0× cap is intentional: beyond a certain point, adding more detectors provides diminishing information, and the DSPOT threshold provides the final calibration for false positive rate.

### When Only One Detector Fires

A single high-confidence detector (e.g. HST at z = 5.2) still produces a blended score above the DSPOT threshold if its z-score is large enough. Amplification is not required for an alert to fire — it is a confidence booster, not a gate. Adjust `dspot_risk_level` to tune sensitivity independently of the amplification logic.

### Warmup and Partial Ensembles

During warmup, some channels remain NaN. The weighted average divides by the active weight sum, so a 2-of-4 active ensemble still produces correctly calibrated scores. Amplification's minimum of 2 converging detectors means the boost does not fire on a single warm detector — the ensemble waits until at least two have calibrated baselines before amplifying.

## Cross-Links

- [Half-Space Trees](hst.md) — content novelty score (HST, weight 0.30)
- [Holt-Winters](holt-winters.md) — volume anomaly score (weight 0.25)
- [CUSUM](cusum.md) — change-point detection score (weight 0.20)
- [Markov Chains](markov.md) — sequence anomaly score (weight 0.25)
- [DSPOT Adaptive Thresholds](dspot.md) — applies the adaptive threshold to the blended score
- [Ensemble Overview](index.md) — how all detectors and scoring connect end-to-end
