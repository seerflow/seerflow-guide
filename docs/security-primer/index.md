# Security Concepts Primer

> **No prior security knowledge required.** This chapter introduces the core concepts you need to understand how Seerflow detects threats. Each section builds on the last — read them in order.

## Why This Chapter?

Seerflow is a log intelligence agent. To understand what it does and why, you need to know a few foundational security concepts. This primer teaches them through a running example: **a real attack scenario** that progresses from a simple brute-force attempt to a full breach.

By the end of this chapter, you'll understand:

- What a **SIEM** does and why organizations need one
- How the **MITRE ATT&CK** framework classifies attacker behavior
- What the **Cyber Kill Chain** is and how attacks progress through stages
- What **Indicators of Compromise (IOCs)** look like in log data
- How **Sigma rules** encode detection logic in a portable format
- Why **anomaly detection** catches threats that rules miss

## Reading Order

These sections build on each other. Start at the top and work down:

| # | Section | What You'll Learn |
|---|---------|------------------|
| 1 | [What is a SIEM?](siem-basics.md) | Log aggregation, detection, and alerting |
| 2 | [MITRE ATT&CK](mitre-attack.md) | How security researchers classify attacker techniques |
| 3 | [Cyber Kill Chain](kill-chain.md) | The 7 stages of a cyberattack |
| 4 | [IOCs & Entities](iocs-entities.md) | The digital fingerprints attackers leave behind |
| 5 | [Sigma Rules](sigma-rules.md) | Portable detection rules that find known threats |
| 6 | [Anomaly Detection](anomaly-detection.md) | Machine learning that finds unknown threats |

!!! tip "The Running Example"
    A single attack scenario — an SSH brute-force attempt that escalates into a full breach — threads through every section. By the end, you'll see how each concept fits together to detect and stop it.
