# Glossary

This glossary defines Seerflow-specific and security terminology used throughout the guide. Each entry links to the chapter where the concept is explained in depth.

## A

Alert
:   A correlated finding promoted from one or more detector scores exceeding the DSPOT threshold. See [Alerting & Feedback](../operations/alerting.md).

Anomaly Score
:   The blended, z-score-normalized output of the detector ensemble in [0, 1]. See [Scoring & Attack Mapping](../detection/scoring.md).

ATT&CK
:   MITRE's framework cataloging adversary tactics, techniques, and common knowledge. See [MITRE ATT&CK](../security-primer/mitre-attack.md).

## B

Beaconing
:   Periodic outbound traffic from a compromised host to a command-and-control server. Detected by Holt-Winters volume anomalies and graph correlation. See [Command & Control rules](../correlation/sigma.md).

biDSPOT
:   Bidirectional variant of DSPOT that tracks upper and lower extreme tails simultaneously. See [DSPOT](../detection/dspot.md).

Blended Score
:   The weighted average of active detector scores with signal amplification applied when multiple detectors converge. See [Scoring](../detection/scoring.md).

## C

Canonical Form
:   Normalized representation of an entity's identity (lowercased, domain-normalized, etc.) used to compute deterministic UUIDs. See [Building the Graph](../entity-graph/construction.md).

Correlation Window
:   Time interval during which events are grouped into the same correlated incident. Configurable via `correlation.window_duration_seconds`. See [Correlation Engine](../correlation/engine.md).

CUSUM
:   Cumulative Sum — streaming change-point detector that catches sustained mean shifts. See [CUSUM](../detection/cusum.md).

## D

Dedup Key
:   A hash used to collapse duplicate alerts within the deduplication window. See [Alerting](../operations/alerting.md).

Dispatcher
:   Component that formats and forwards alerts to configured sinks (Slack, Teams, PagerDuty, OTLP). See [Alerting](../operations/alerting.md).

Drain3
:   Streaming log template extractor. Seerflow uses it to convert raw log lines into template IDs for content anomaly detection. See [Parsing](../architecture/parsing.md).

DSPOT
:   Dynamic SPOT — streaming Peaks Over Threshold with drift handling. Provides adaptive anomaly thresholds. See [DSPOT](../detection/dspot.md).

Dwell Time
:   Duration an attacker remains undetected inside a network. Reducing dwell time is a primary goal of anomaly detection. See [SIEM Basics](../security-primer/siem-basics.md).

## E

Edge
:   A connection between two entities in the graph, typed by relationship kind (e.g., `connects_to`, `authenticates_as`). See [Entity Graph](../entity-graph/construction.md).

Entity
:   A security-relevant noun extracted from log events — user, IP, host, process, file, or domain. See [Entity Graph](../entity-graph/construction.md).

Entity Resolution
:   The process of mapping raw log fields to canonical entity IDs via UUID5 namespacing. See [Building the Graph](../entity-graph/construction.md).

Event
:   A single parsed log record in Seerflow's unified `SeerflowEvent` schema. See [Event Model](../architecture/event-model.md).

EVT
:   Extreme Value Theory — mathematical framework DSPOT uses for adaptive thresholding. See [DSPOT](../detection/dspot.md).

## F

Feature Extraction
:   The pipeline stage that converts a parsed event into numeric features for the detector ensemble. See [Pipeline](../architecture/pipeline.md).

## G

GPD
:   Generalized Pareto Distribution — the tail distribution DSPOT fits to excesses above a threshold. See [DSPOT](../detection/dspot.md).

Graph
:   The entity graph maintained by Seerflow, built from co-occurring entities in events. See [Entity Graph](../entity-graph/construction.md).

Graph-Structural
:   Correlation strategy that detects anomalies in graph topology (sudden betweenness, new bridges). See [Graph-Structural Correlation](../correlation/graph-structural.md).

## H

Half-Space Trees
:   Streaming content anomaly detector. Catches novel patterns by measuring how far an event falls from historical feature densities. See [Half-Space Trees](../detection/hst.md).

Holt-Winters
:   Triple-exponential smoothing algorithm used for volume anomaly detection with seasonal baseline. See [Holt-Winters](../detection/holt-winters.md).

HST
:   See Half-Space Trees.

## I

Ingestion
:   The pipeline stage where log sources are received and buffered for parsing. See [Pipeline](../architecture/pipeline.md).

IOC
:   Indicator of Compromise — a static artifact (IP, hash, domain) associated with known malicious activity. See [IOCs & Entities](../security-primer/iocs-entities.md).

## K

Kill Chain
:   Lockheed Martin's model of adversary progression from reconnaissance to objectives. See [Cyber Kill Chain](../security-primer/kill-chain.md).

Kill-Chain Traversal
:   A correlated incident that spans multiple kill-chain stages, indicating a sustained attack. See [Kill Chain Correlation](../correlation/kill-chain.md).

## L

Late Tolerance
:   Maximum acceptable clock skew for out-of-order events before they're dropped by the correlation watermark. `correlation.late_tolerance_seconds`. See [Correlation Engine](../correlation/engine.md).

Lateral Movement
:   Attacker technique of moving from an initial foothold to other hosts. Detected via graph-structural correlation. See [Lateral Movement tactic](../correlation/sigma.md).

## M

Markov Chain
:   Streaming sequence anomaly detector. Scores state transitions against a learned transition matrix. See [Markov Chains](../detection/markov.md).

MITRE
:   MITRE Corporation — publisher of the ATT&CK framework. See [MITRE ATT&CK](../security-primer/mitre-attack.md).

ModelStore
:   Storage protocol interface for ML detector state persistence. Lets detectors survive restarts. See [Storage](../operations/storage.md).

## N

Node
:   A vertex in the entity graph representing a single entity. See [Entity Graph](../entity-graph/construction.md).

## O

OTLP
:   OpenTelemetry Protocol — the wire format Seerflow's OTLP receiver consumes and its alert export emits. See [Pipeline](../architecture/pipeline.md).

## P

Parser
:   The pipeline component that converts a raw log line into a structured `SeerflowEvent`. See [Parsing](../architecture/parsing.md).

## R

Receiver
:   The pipeline entry point for a log source (OTLP, file tail, syslog, etc.). See [Receivers](../architecture/receivers.md).

Risk Accumulation
:   Correlation strategy that sums per-event risk over a time window per entity. See [Risk Accumulation](../correlation/risk-accumulation.md).

Risk Level
:   DSPOT's tail probability cutoff. Default `0.0001` = 1-in-10,000. Lower = more sensitive. See [DSPOT](../detection/dspot.md).

## S

SIEM
:   Security Information and Event Management — the category of product Seerflow complements. See [SIEM Basics](../security-primer/siem-basics.md).

Sigma Rule
:   A YAML-formatted detection rule in the SigmaHQ rule collection. Seerflow ships 3,000+ bundled rules. See [Sigma Rules](../correlation/sigma.md).

Sub-Technique
:   A more specific categorization under an ATT&CK technique (e.g., T1078.003). See [MITRE ATT&CK](../security-primer/mitre-attack.md).

## T

Tactic
:   Highest-level category in ATT&CK, representing an adversary's goal (e.g., Initial Access, Persistence). See [MITRE ATT&CK](../security-primer/mitre-attack.md).

Tail Probability
:   In DSPOT, the probability that a legitimate value exceeds the current threshold. See [DSPOT](../detection/dspot.md).

Technique
:   Mid-level ATT&CK category describing how an adversary achieves a tactic (e.g., T1078 Valid Accounts). See [MITRE ATT&CK](../security-primer/mitre-attack.md).

Template
:   A Drain3-extracted log pattern (e.g., `sshd: Failed password for <*> from <*>`). See [Parsing](../architecture/parsing.md).

TTP
:   Tactics, Techniques, and Procedures — the behavioral fingerprint of an adversary. See [IOCs & Entities](../security-primer/iocs-entities.md).

## U

UUID5
:   Deterministic UUID derived from a namespace + canonical name. Seerflow uses UUID5 for entity IDs so the same entity always resolves to the same node. See [Entity Graph](../entity-graph/construction.md).

## W

WAL Mode
:   SQLite's Write-Ahead Log durability mode. Enables concurrent reads during writes. See [Storage](../operations/storage.md).

Watermark
:   The timestamp boundary below which the correlator considers events "settled" and no longer accepts late arrivals. See [Correlation Engine](../correlation/engine.md).

Welford Accumulator
:   Numerically stable online algorithm for computing running mean and variance. Used for z-score normalization in the detector ensemble. See [Scoring](../detection/scoring.md).

## Z

Z-Score
:   A raw detector score normalized against its historical distribution using a running mean and standard deviation. See [Scoring](../detection/scoring.md).
