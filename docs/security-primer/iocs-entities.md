# IOCs & Entity Extraction

Every attacker leaves traces. In our SSH example, the attacker left several: an IP (`198.51.100.23`), a username (`deploy`), a hostname (`web-prod-01`), a domain (`evil-c2.example.com`). These traces are scattered across different log files, servers, and tools. Individually, each looks like ordinary data. Together, they tell the story of a breach.

---

## Indicators of Compromise (IOCs)

An **Indicator of Compromise (IOC)** is any observable artifact that suggests a system has been breached or is under attack. Think of IOCs as digital fingerprints at a crime scene. Just as a detective collects fingerprints and shell casings, a security analyst collects IP addresses, file hashes, and domain names.

IOCs don't prove guilt on their own. A single IP in a log might be perfectly benign. But when that same IP shows up in failed SSH logins, blocked firewall connections, and DNS queries to a known malicious domain — the fingerprints form a pattern.

### Common IOC Types

| IOC Type | What It Is | Example | Where You Find It |
|----------|-----------|---------|-------------------|
| **IP Address** | A numeric address identifying a network device | `198.51.100.23` | Firewall logs, SSH logs, web access logs |
| **Domain** | A human-readable name that resolves to an IP via DNS (Domain Name System) | `evil-c2.example.com` | DNS query logs, proxy logs, email headers |
| **File Hash** | A cryptographic fingerprint of a file's contents (SHA-256, MD5) | `a1b2c3d4e5f6...` | Endpoint detection logs, antivirus alerts |
| **Username** | An account identifier on a system | `deploy` | Authentication logs, SSH logs, audit trails |
| **Process** | A running program, identified by name or ID | `/tmp/.hidden/rev_shell` | Process execution logs, syslog |
| **URL / Path** | A web address or file path tied to malicious activity | `/wp-admin/shell.php` | Web server logs, proxy logs |

### IOCs in Our SSH Attack

As the brute-force attack progresses into a full breach, the attacker scatters fingerprints across every log source:

```text title="SSH authentication log"
Failed password for deploy from 198.51.100.23 port 44231 ssh2
Accepted password for deploy from 198.51.100.23 port 44987 ssh2
```

```text title="DNS query log"
query: evil-c2.example.com A record from 10.0.1.15 (web-prod-01)
```

```text title="Process execution log"
web-prod-01: /tmp/.hidden/rev_shell executed by user deploy (PID 28841)
```

Three log sources. Five IOCs: the IP `198.51.100.23`, the username `deploy`, the hostname `web-prod-01`, the domain `evil-c2.example.com`, and the process `/tmp/.hidden/rev_shell`. A human analyst could piece this together — but only if they look in all three places. An automated system needs a way to link these traces. That is where entities come in.

---

## From IOCs to Entities

An IOC is a single data point. An **entity** is the "who" or "what" behind one or more IOCs — a user, a machine, a network address — that persists across multiple log events and sources.

The distinction matters because attackers don't stay in one log file. The IP `198.51.100.23` shows up everywhere the attacker goes:

| Log Source | Log Entry | Entity Involved |
|-----------|-----------|-----------------|
| **SSH log** | `Failed password for deploy from 198.51.100.23` | IP `198.51.100.23`, User `deploy` |
| **Firewall log** | `DENY 198.51.100.23 -> 10.0.1.15:3306 (MySQL)` | IP `198.51.100.23`, Host `10.0.1.15` |
| **DNS log** | `198.51.100.23 queried evil-c2.example.com` | IP `198.51.100.23`, Domain `evil-c2.example.com` |
| **Web access log** | `198.51.100.23 POST /api/upload 200` | IP `198.51.100.23` |

By treating `198.51.100.23` as an entity, a security tool can aggregate every event involving that IP across all sources. Instead of four isolated log lines, you get a timeline: brute-forced SSH, blocked reaching the database, resolved a suspicious domain, uploaded via the web API. Entities turn scattered IOCs into a narrative.

---

## Entity Resolution

Real infrastructure is messy. The same machine can appear under different identifiers depending on which log source recorded it:

| Identifier | Format | Log Source |
|-----------|--------|------------|
| `web-prod-01` | Hostname (short name assigned by the OS) | SSH logs, syslog |
| `10.0.1.15` | Internal IP address (private network) | Firewall logs, flow logs |
| `web-prod-01.corp.example.com` | FQDN — Fully Qualified Domain Name (complete hostname + domain) | DNS logs, certificate logs |
| `i-0a1b2c3d4e5f67890` | Cloud instance ID (AWS, GCP, or Azure) | Cloud audit logs |

All four refer to the same server. If a security tool treats each as separate, it fragments the attack story. **Entity resolution** is the process of recognizing that different identifiers refer to the same thing and merging them into a single entity.

It works by maintaining a mapping between known aliases. When one log mentions `10.0.1.15` and another mentions `web-prod-01`, the system knows those are the same host and attributes both events to one entity. Without resolution, the firewall block and the SSH login look unrelated. With it, they become two steps in the same attack.

---

## Why Entities Matter More Than Individual IOCs

A single IOC tells you very little. One failed login could be a typo. But when entities tie IOCs together across sources and time, a picture emerges:

1. The IP `198.51.100.23` failed SSH logins 47 times (brute force)
2. The same IP succeeded on attempt 48 (credential compromise)
3. The compromised host `web-prod-01` then queried `evil-c2.example.com` (command-and-control)
4. A suspicious process launched on that host (payload execution)

No single log source contains all four facts. Entities are the connective tissue that makes cross-source correlation possible.

---

!!! info "How Seerflow Uses This"

    - Seerflow extracts **six entity types** from every log event: **IP address**, **user**, **hostname**, **domain**, **process**, and **file**. These are the building blocks of all downstream detection and correlation.
    - **Entity resolution** bridges identity gaps automatically — linking hostname to IP, IP to FQDN, cloud instance ID back to the same host. When `web-prod-01`, `10.0.1.15`, and `i-0a1b2c3d4e5f67890` appear in different logs, Seerflow knows they are the same machine.
    - Entities power the **entity graph** — a network data structure connecting users, IPs, hosts, and domains through observed relationships. When user `deploy` authenticates from `198.51.100.23` to `web-prod-01`, which then queries `evil-c2.example.com`, those relationships become edges in the graph.
    - The **KillChainTracker** tracks entity progression across all log sources, mapping each step to the corresponding kill chain stage. It recognizes that a brute-force attempt, a successful login, a C2 connection, and data exfiltration are part of the same attack — even when each step appears in a different log.

    **Next:** [Sigma Rules →](sigma-rules.md)
