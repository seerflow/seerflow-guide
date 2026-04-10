# Cyber Kill Chain

Our SSH attacker didn't just guess a password and call it a day. After getting in, they moved laterally, escalated privileges, and exfiltrated data. That progression -- from initial scouting to mission complete -- follows a predictable pattern. Understanding that pattern is the key to stopping attacks before they succeed.

## The Lockheed Martin Cyber Kill Chain

In 2011, researchers at Lockheed Martin published [a paper](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/cyber/LM-White-Paper-Intel-Driven-Defense.pdf) describing cyberattacks as a sequence of stages, borrowing the military concept of a "kill chain" -- a systematic process an adversary must complete to achieve their objective. The insight: **an attack is not a single event. It is a chain of dependent steps, and breaking any one link stops the entire attack.**

They identified seven stages that virtually all intrusions follow. Hover any stage below for its full description — stages are colored in sequence to emphasize the linear progression.

<div class="seerflow-viz"
     data-viz="pipeline-sequence"
     data-src="../../assets/viz-data/kill-chain.json"
     style="min-height: 460px;"></div>

Let's walk through each stage, then map them to our running SSH attack example.

### Stage 1: Reconnaissance

The attacker gathers information about the target -- reading public employee profiles, scanning DNS records, or running a port scan (a tool that probes a server to discover which network services are running). Our SSH attacker scans IP ranges looking for servers with port 22 (SSH) open to the internet.

### Stage 2: Weaponization

The attacker prepares their tools and attack payload (the malicious code or technique they plan to use). This happens entirely on the attacker's side. For our SSH scenario, the attacker loads a credential-stuffing dictionary -- millions of username/password pairs leaked from previous breaches -- into their automated login tool.

### Stage 3: Delivery

The weapon reaches the target. Common delivery methods include phishing emails (fraudulent messages designed to trick recipients into clicking malicious links), compromised websites, and direct network connections. Our attacker initiates thousands of SSH login attempts against the server, each trying a different username/password combination.

### Stage 4: Exploitation

The attacker triggers a vulnerability (a weakness in software, configuration, or human behavior). Our SSH attacker hits a valid credential -- a developer reused a password from a previous data breach. The server accepts the login, and the attacker has a shell session (an interactive command line on the target machine).

### Stage 5: Installation

The attacker installs persistent access mechanisms so they can return even if the current session drops. They might create a new user account, plant a backdoor (hidden software that provides unauthorized access), or add their SSH key to the server's authorized keys file. Our attacker appends their public key to `~/.ssh/authorized_keys` and creates a cron job (a scheduled task) that re-establishes access every hour.

### Stage 6: Command and Control (C2)

The attacker establishes a reliable communication channel back to their own infrastructure. This C2 channel lets them issue commands remotely, upload tools, and download stolen data. Our attacker sets up a reverse tunnel -- an encrypted connection from the compromised server back to a server they control -- disguised as normal HTTPS traffic.

### Stage 7: Actions on Objectives

The attacker executes their actual mission: stealing intellectual property, encrypting files for ransom, destroying data, or pivoting deeper into the network. Our attacker discovers database credentials in the application's configuration files and begins exfiltrating (extracting and transferring) customer records to an external server.

## Our SSH Attack, Stage by Stage

| Kill Chain Stage | What Our Attacker Did | What Appeared in the Logs |
|---|---|---|
| **1. Reconnaissance** | Port-scanned IP ranges for open SSH | Connection attempts on port 22 from multiple IPs |
| **2. Weaponization** | Loaded credential-stuffing dictionary | *(No logs -- happens on attacker's machine)* |
| **3. Delivery** | Launched brute-force SSH login attempts | Thousands of `Failed password` entries in `auth.log` |
| **4. Exploitation** | Found a valid reused password | Single `Accepted password` after many failures |
| **5. Installation** | Added SSH key, created cron job | `authorized_keys` modified, new crontab entry |
| **6. Command & Control** | Opened reverse SSH tunnel | Outbound connection to unknown external IP on port 443 |
| **7. Actions on Objectives** | Exfiltrated database records | Unusual database queries, large outbound data transfer |

## Why "Kill Chain"?

The military analogy is deliberate. In a physical kill chain, disrupting any single stage stops the entire sequence. The same applies to cyberattacks:

- **Block reconnaissance** by hiding exposed services behind a VPN.
- **Block delivery** by rate-limiting SSH login attempts.
- **Block installation** by monitoring file integrity on critical servers.
- **Block C2** by flagging unusual outbound connections.

You don't need to catch every stage. **Catching any one stage is enough to break the chain.** This is why defense-in-depth (layering multiple detection mechanisms) works -- each layer is another chance to stop the attacker.

## Kill Chain Stages and MITRE ATT&CK

The Cyber Kill Chain provides a high-level view of attack progression. MITRE ATT&CK (introduced in the [previous section](mitre-attack.md)) provides the granular catalog of specific techniques within each stage. The two frameworks complement each other:

| Kill Chain Stage | MITRE ATT&CK Tactic(s) | Description |
|---|---|---|
| **1. Reconnaissance** | [Reconnaissance (TA0043)](https://attack.mitre.org/tactics/TA0043/) | Gathering target information |
| **2. Weaponization** | [Resource Development (TA0042)](https://attack.mitre.org/tactics/TA0042/) | Building tools, acquiring infrastructure |
| **3. Delivery** | [Initial Access (TA0001)](https://attack.mitre.org/tactics/TA0001/) | Getting a foothold on the target |
| **4. Exploitation** | [Execution (TA0002)](https://attack.mitre.org/tactics/TA0002/) | Running malicious code |
| **5. Installation** | [Persistence (TA0003)](https://attack.mitre.org/tactics/TA0003/), [Privilege Escalation (TA0004)](https://attack.mitre.org/tactics/TA0004/), [Defense Evasion (TA0005)](https://attack.mitre.org/tactics/TA0005/) | Maintaining and deepening access |
| **6. Command & Control** | [Command and Control (TA0011)](https://attack.mitre.org/tactics/TA0011/) | Communicating with compromised systems |
| **7. Actions on Objectives** | [Collection (TA0009)](https://attack.mitre.org/tactics/TA0009/), [Exfiltration (TA0010)](https://attack.mitre.org/tactics/TA0010/), [Impact (TA0040)](https://attack.mitre.org/tactics/TA0040/) | Achieving the mission goal |

Notice that Installation maps to three ATT&CK tactics -- once inside, attackers simultaneously work to persist (stay on the system), escalate privileges (gain higher-level permissions), and evade defenses (hide their tracks). Similarly, the final stage can involve collecting data, moving it out, or causing damage -- often all three.

!!! info "How Seerflow Uses This"
    Seerflow's **KillChainTracker** monitors each entity (IP address, user account, hostname) for progression through ATT&CK tactics over time. Here is how it works:

    - **Every alert carries ATT&CK tactic tags.** When Seerflow fires an alert -- whether from a Sigma rule match, an anomaly detector, or a correlation rule -- it attaches the relevant ATT&CK tactic IDs (like TA0003 for Persistence or TA0011 for Command and Control).
    - **The tracker watches for tactic accumulation per entity.** It maintains a sliding window of recent tactics observed for each entity in the system.
    - **When an entity hits a tactic threshold, a kill-chain alert fires.** For example, if a single IP address triggers alerts spanning 3 or more distinct ATT&CK tactics within a 10-minute window, Seerflow recognizes this as potential kill-chain progression and fires a high-severity composite alert.
    - **Example from our SSH scenario:** The attacker's IP first triggers a Credential Access alert (brute-force detection), then a Persistence alert (authorized_keys modification), then a Command and Control alert (reverse tunnel). Three distinct tactics from one entity in minutes -- the KillChainTracker fires, escalating this from isolated alerts to a confirmed multi-stage attack.

    **Next:** [IOCs & Entities &rarr;](iocs-entities.md)
