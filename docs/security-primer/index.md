# Security Concepts Primer

**No prior security knowledge required.** This chapter introduces the core concepts you need to understand how Seerflow detects threats. Each section builds on the last — read them in order.

## Why this chapter?

Seerflow is a log intelligence agent. To understand what it does and why, you need to know a few foundational security concepts. This primer teaches them through a running example: **a real attack scenario** that progresses from a simple brute-force attempt to a full breach.

By the end of this chapter, you'll understand:

- What a **SIEM** does and why organizations need one
- How the **MITRE ATT&CK** framework classifies attacker behavior
- What the **Cyber Kill Chain** is and how attacks progress through stages
- What **Indicators of Compromise (IOCs)** look like in log data
- How **Sigma rules** encode detection logic in a portable format
- Why **anomaly detection** catches threats that rules miss

## Reading order

These sections build on each other. Start at the top and work down:

| # | Section | What you'll learn |
|---|---------|------------------|
| 1 | [What is a SIEM?](siem-basics.md) | Log aggregation, detection, and alerting |
| 2 | [MITRE ATT&CK](mitre-attack.md) | How security researchers classify attacker techniques |
| 3 | [Cyber Kill Chain](kill-chain.md) | The 7 stages of a cyberattack |
| 4 | [IOCs & Entities](iocs-entities.md) | The digital fingerprints attackers leave behind |
| 5 | [Sigma Rules](sigma-rules.md) | Portable detection rules that find known threats |
| 6 | [Anomaly Detection](anomaly-detection.md) | Machine learning that finds unknown threats |

## The running example

!!! info "A single story across six sections"
    A single attack scenario — an **SSH brute-force attempt that escalates into a full breach** — threads through every section. By the end, you'll see how each concept fits together to detect and stop it.

<div class="sf-stages" markdown>
<span class="sf-stages__title">The attacker's path · 7 stages</span>
<div class="sf-stages__row">
<div class="sf-stage"><span class="sf-stage__t">T-0</span><span class="sf-stage__l">Recon</span><span class="sf-stage__d">IP scans inbound</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+5</span><span class="sf-stage__l">Brute force</span><span class="sf-stage__d">180× ssh failed</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+9</span><span class="sf-stage__l">Access</span><span class="sf-stage__d">login succeeds</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+11</span><span class="sf-stage__l">Persistence</span><span class="sf-stage__d">authorized_keys</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+13</span><span class="sf-stage__l">Privilege esc.</span><span class="sf-stage__d">sudo to root</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+18</span><span class="sf-stage__l">Creds</span><span class="sf-stage__d">/etc/shadow read</span></div>
<div class="sf-stage"><span class="sf-stage__t">T+24</span><span class="sf-stage__l">Exfil</span><span class="sf-stage__d">tar.gz over scp</span></div>
</div>
</div>
