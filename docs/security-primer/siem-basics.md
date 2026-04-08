# What is a SIEM?

Your company has 50 servers. They run your website, handle payments, store customer data, and process background jobs. Every second of every day, each one writes **log lines** — plain-text records of what just happened. A user logged in. A file was opened. A network connection was refused. Multiply that by 50 machines and you're looking at millions of log lines per day.

Now imagine this: at 3:07 AM on a Tuesday, an attacker starts trying passwords against one of your SSH servers. They rattle through 10,000 username-and-password combinations in under an hour. The logs faithfully record every single failed attempt — but nobody is watching. By 4:12 AM the attacker guesses a valid password, logs in, and starts exploring your network.

The logs *had* the evidence. The problem wasn't a lack of data. The problem was that no one — and no system — was looking at it.

That is the problem a **SIEM** solves.

---

## SIEM, Defined

**SIEM** stands for **Security Information and Event Management**. In plain language, a SIEM is software that:

1. **Collects** logs from all of your servers, applications, and network devices into one place.
2. **Detects** suspicious patterns in those logs — things like the brute-force attack above.
3. **Alerts** a human (or another system) when something needs attention.

Think of it as a security camera system for your infrastructure. Individual cameras (servers) record footage (logs), the SIEM is the monitoring room that watches all the feeds at once, and the alerts are the alarm that sounds when it spots something wrong.

---

## The Three Pillars

Every SIEM — whether it costs millions of dollars or runs on a single laptop — performs the same three jobs. The specifics vary, but the pattern is universal.

| Pillar | What It Does | Why It Matters |
|--------|-------------|----------------|
| **Collect** | Gathers logs from every source — servers, firewalls, cloud providers, applications — and stores them in a central location. | An attacker's footprint is rarely on one machine. You need the full picture to see the full attack. |
| **Detect** | Analyzes incoming logs against rules, statistical models, or known threat signatures to identify suspicious activity. | Humans cannot read millions of log lines. Detection automates the work of a tireless analyst. |
| **Alert** | Sends a notification — email, Slack message, PagerDuty page, webhook — when detection finds something that requires a response. | Detection without notification is useless. The right person needs to know at the right time. |

These three pillars form a loop. Collection feeds detection, detection triggers alerts, and the response to alerts often leads to new rules that improve future detection.

---

## A Concrete Example: The Brute-Force Attack

Let's go back to that 3 AM attack. Here is what those SSH brute-force attempts actually look like in your server's logs. These are **syslog**-formatted lines — the standard format most Linux servers use to record events.

```syslog
Mar 12 03:07:14 web-prod-01 sshd[28410]: Failed password for invalid user admin from 198.51.100.23 port 44821 ssh2
Mar 12 03:07:15 web-prod-01 sshd[28412]: Failed password for invalid user root from 198.51.100.23 port 44822 ssh2
Mar 12 03:07:15 web-prod-01 sshd[28414]: Failed password for invalid user ubuntu from 198.51.100.23 port 44823 ssh2
Mar 12 03:07:16 web-prod-01 sshd[28416]: Failed password for invalid user deploy from 198.51.100.23 port 44824 ssh2
Mar 12 03:07:17 web-prod-01 sshd[28418]: Failed password for invalid user postgres from 198.51.100.23 port 44825 ssh2
Mar 12 03:07:17 web-prod-01 sshd[28420]: Failed password for invalid user test from 198.51.100.23 port 44826 ssh2
```

Each line contains a **timestamp** (`Mar 12 03:07:14`), a **hostname** (`web-prod-01`), a **process name and ID** (`sshd[28410]`), and a **message** describing what happened. The attacker's IP address — `198.51.100.23` — appears in every line.

One failed login is routine. Six in three seconds, all from the same IP, cycling through common usernames? That is a brute-force attack. A SIEM sees this pattern and fires an alert.

Without a SIEM, these six lines sit buried among the millions of other log lines that `web-prod-01` generated that night. They would not be noticed until long after the damage was done — if they were noticed at all.

---

## Why Not Just Read the Logs?

Fair question. Three practical reasons:

**Volume.** Fifty servers producing logs around the clock means hundreds of gigabytes per month. No human can keep up, and critical events get drowned out by routine noise.

**Correlation.** The attacker might brute-force SSH on `web-prod-01`, then pivot to `db-prod-01`, then exfiltrate data through `api-prod-02`. Each server only sees its own piece. A SIEM correlates events across sources so you see the full chain. **Correlation** means linking related events from different sources and times into a single narrative — turning scattered clues into a coherent story.

**Speed.** In a brute-force attack, the window between "first failed login" and "successful login" can be minutes. A SIEM detects and alerts in real time. An analyst reviewing logs the next morning is already too late.

---

## The Evolution: From Batch to Streaming

Traditional SIEMs work in **batch** mode — they collect logs, store them, and run detection queries on a schedule (say, every five minutes or every hour). This creates a gap: events that happen between runs might not be caught until the next cycle.

Modern SIEMs process logs as a **stream** — each log line is analyzed the instant it arrives. There is no delay between an event happening and the SIEM seeing it. This is the difference between reviewing security camera footage at the end of each shift versus watching the live feed.

---

!!! info "How Seerflow Uses This"

    Seerflow is a **streaming SIEM** — it processes every log line as it arrives, not in scheduled batches. There is no five-minute gap between an event and detection.

    Here is how Seerflow implements the three pillars:

    - **Collect:** Seerflow uses **OpenTelemetry** receivers to ingest logs from AWS CloudWatch, GCP Cloud Logging, Azure Monitor, syslog, files, and Kafka. OpenTelemetry is an open standard for collecting and transmitting observability data (logs, metrics, traces) from any source.
    - **Detect:** Instead of relying solely on static rules, Seerflow runs **streaming ML models** (machine learning algorithms that learn and update continuously) alongside **Sigma rules** (a portable, open-source format for writing detection logic that works across different SIEM products). The ML models catch novel threats that no rule has been written for yet; the Sigma rules catch known attack patterns with precision.
    - **Alert:** When detection fires, Seerflow sends notifications through **PagerDuty** (an incident management platform) and configurable **webhook** integrations for Slack, Microsoft Teams, or any HTTP endpoint.

    **Next:** [MITRE ATT&CK &rarr;](mitre-attack.md)
