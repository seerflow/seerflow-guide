# Sigma Rules

> **Prerequisite:** This page builds on [What is a SIEM?](siem-basics.md) and [MITRE ATT&CK](mitre-attack.md). Read those first if you haven't.

## The Vendor Lock-In Problem

In the previous section, we introduced the idea that a **SIEM** (Security Information and Event Management system) collects logs and runs detection rules against them. What we didn't mention is a painful industry reality: every SIEM speaks its own language.

Splunk uses **SPL** (Search Processing Language). Elastic uses **KQL** (Kibana Query Language) and **EQL** (Event Query Language). Microsoft Sentinel uses **KQL** (Kusto Query Language — same acronym, different language). IBM QRadar uses **AQL**. Each one has its own syntax, its own quirks, and its own limitations.

This means that if a security team writes 500 detection rules in Splunk's SPL and then migrates to Elastic, those rules are worthless. Every single one must be rewritten by hand. The detection logic — the actual security knowledge about what attackers do — is trapped inside a vendor-specific format. This is **vendor lock-in**, and it affects every organization that invests in detection engineering.

The problem gets worse at scale. The security community constantly discovers new attack techniques. Researchers want to share detection logic with the world, but if they write it in SPL, only Splunk users benefit. The knowledge stays siloed.

## Sigma: A Universal Language for Log Detection

**Sigma** is an open, vendor-neutral format for writing log detection rules. It was created in 2017 by Florian Roth and Thomas Patzke specifically to solve the vendor lock-in problem. Sigma rules are written in **YAML** (a human-readable data format) and can be converted — or "compiled" — into the query language of any supported SIEM.

Think of Sigma as the Esperanto of security detection. You write the rule once, and a compiler translates it into SPL, KQL, EQL, or whatever your SIEM understands.

Sigma is not the first "write once, run anywhere" format in security. It follows a well-established pattern:

| Format | Domain | What It Detects |
|--------|--------|-----------------|
| **Snort** / Suricata | Network traffic | Malicious packets, network intrusions |
| **YARA** | Files and memory | Malware, suspicious binaries |
| **Sigma** | Log events | Attacker behavior recorded in logs |

Just as Snort rules let network defenders share intrusion signatures regardless of which IDS (Intrusion Detection System — a device that monitors network traffic for threats) they run, Sigma rules let log analysts share detection logic regardless of which SIEM they use.

## Anatomy of a Sigma Rule

A Sigma rule is a structured YAML document with clearly defined sections. Let's walk through a real rule — one that ships with Seerflow's bundled rule set — and break down every part.

```yaml
title: Privileged User Has Been Created          # Human-readable name
id: 0ac15ec3-d24f-4246-aa2a-3077bb1cf90e        # Unique identifier (UUID)
status: test                                      # Rule maturity: test -> stable
description: >                                    # What this rule detects
  Detects the addition of a new user to a
  privileged group such as "root" or "sudo"

tags:                                             # ATT&CK classification
    - attack.privilege-escalation                 # Tactic: Privilege Escalation
    - attack.persistence                          # Tactic: Persistence
    - attack.t1136.001                            # Technique: Create Account (Local)
    - attack.t1098                                # Technique: Account Manipulation

logsource:                                        # WHERE to look
    product: linux                                # Linux system logs

detection:                                        # WHAT to look for
    selection_new_user:
        - 'new user'                              # Log line contains "new user"
    selection_uids_gids:
        - 'GID=0,'                                # root group
        - 'UID=0,'                                # root UID
        - 'GID=10,'                               # wheel group
        - 'GID=27,'                               # sudo group
    condition: all of selection_*                  # BOTH selections must match

falsepositives:                                   # Known benign triggers
    - Administrative activity                     # Legitimate admin creating users
level: high                                       # Severity: informational -> high -> critical
```

Each section answers a specific question. Here is a reference table:

| Section | Key Question It Answers | Example from This Rule |
|---------|------------------------|------------------------|
| **title / description** | What does this rule detect, in plain language? | "Detects the addition of a new user to a privileged group" |
| **tags** | Which ATT&CK tactics and techniques does this map to? | Privilege Escalation (tactic), T1136.001 — Create Local Account (technique) |
| **logsource** | Which logs should be searched? | Linux system logs (`product: linux`) |
| **detection** | What specific patterns indicate the threat? | Log line contains "new user" AND a privileged UID/GID |
| **condition** | How do the detection patterns combine? | `all of selection_*` — every selection block must match |
| **level** | How severe is this if it fires? | `high` — significant security event, needs investigation |

The **condition** field is where Sigma's logic lives. Common operators include `all of` (every named selection must match), `1 of` (any single selection is enough), and Boolean combinations with `and`, `or`, and `not`. The wildcard `selection_*` matches all detection blocks whose names start with `selection_`.

## SigmaHQ: The Community Rule Library

Individual Sigma rules are useful. Thousands of them are transformative.

**SigmaHQ** is the official community repository of peer-reviewed Sigma rules. As of 2026, it contains over **3,000 rules** covering:

- **Linux** — privilege escalation, persistence, suspicious process execution
- **Windows** — PowerShell abuse, registry manipulation, lateral movement, credential access
- **Web servers** — SQL injection attempts, path traversal, web shells
- **DNS** — domain generation algorithms, tunneling, known malicious domains
- **Cloud** — AWS, Azure, and GCP misconfigurations, suspicious API calls

Every rule in SigmaHQ goes through community review, is tagged with MITRE ATT&CK references, and includes false positive guidance. It is the largest open-source collection of detection logic in the world.

## Running Example: Catching a Backdoor User

Let's return to our running attack scenario. Our attacker — still operating from `198.51.100.23` on `web-prod-01` — has already brute-forced an SSH login and gained a foothold. Now they want to ensure they can get back in even if the compromised password is changed. Their next move: create a **backdoor user** — a hidden account with root-level privileges.

The attacker runs:

```bash
useradd -o -u 0 -g 0 -M -d /dev/null -s /bin/bash svc_backup
```

This creates a user called `svc_backup` with **UID=0** (the same as root) and **GID=0** (the root group). The `-o` flag allows the duplicate UID. The name `svc_backup` is chosen to look like a legitimate service account.

The Linux system writes this to `/var/log/auth.log`:

```
Apr  7 02:14:33 web-prod-01 useradd[4821]: new user: name=svc_backup, UID=0, GID=0, home=/dev/null, shell=/bin/bash
```

Now, does our Sigma rule fire? Let's check both selections:

1. **`selection_new_user`** — Does the log line contain `"new user"`? Yes: `new user: name=svc_backup`. **Match.**

2. **`selection_uids_gids`** — Does it contain any of `GID=0,`, `UID=0,`, `GID=10,`, or `GID=27,`? Yes: both `UID=0,` and `GID=0,` appear. **Match.**

3. **`condition: all of selection_*`** — Both selections matched. **The rule fires.**

The result is a **high-severity alert**: "Privileged User Has Been Created." Because the rule carries ATT&CK tags, the alert automatically inherits those classifications — Privilege Escalation, Persistence, T1136.001, T1098. Downstream systems (and humans) immediately know what category of attack behavior this represents.

Without this rule, the log line would be just another entry in a file that nobody reads. With it, the creation of `svc_backup` becomes an actionable security event within seconds.

## Rules vs. Anomaly Detection

Sigma rules are powerful, but they have a fundamental limitation: they can only detect **what you've already thought of**. Each rule encodes a specific pattern — a known technique, a known indicator. If an attacker invents a novel approach that no rule covers, it passes through undetected.

This is why modern detection systems pair rules with **anomaly detection** — statistical and machine learning methods that flag behavior simply because it is unusual, even if no rule exists for it. The next section covers how this works.

!!! info "How Seerflow Uses This"
    Seerflow's Sigma engine loads the full **bundled SigmaHQ rule set** plus any **custom rules** you add. At startup, it indexes every rule by its `logsource` fields (product, category, service) and builds a dispatch table. When a log event arrives, Seerflow checks its source metadata and routes it **only to rules whose logsource matches** — a technique called **logsource-indexed dispatch**. This means Seerflow can evaluate thousands of rules efficiently: a Linux auth log is never tested against Windows registry rules, and vice versa.

    When a rule matches, the resulting alert **inherits the rule's ATT&CK tags** automatically. These tags flow directly into Seerflow's [KillChainTracker](../correlation/kill-chain.md), which tracks how far an attacker has progressed through the kill chain for each entity. A single Sigma match can advance an entity from one kill chain stage to the next, escalating its risk score and triggering higher-priority alerts.

    **Next:** [Anomaly Detection &rarr;](anomaly-detection.md)
