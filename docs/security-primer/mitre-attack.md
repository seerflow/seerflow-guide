# MITRE ATT&CK Framework

In the previous section, we saw an attacker try thousands of SSH passwords. Security researchers have a name for this: **[T1110 --- Brute Force](https://attack.mitre.org/techniques/T1110/)**. That identifier comes from a framework called [MITRE ATT&CK](https://attack.mitre.org/), and it is the closest thing the cybersecurity industry has to a universal language for describing what attackers do.

## A Field Guide to Attacker Behavior

Think of ATT&CK (Adversarial Tactics, Techniques, and Common Knowledge) as a field guide to wildlife, except the wildlife is malicious. A birdwatcher's guide organizes species by habitat, appearance, and behavior so you can identify what you are looking at in the field. ATT&CK does the same thing for cyberattacks: it organizes every known attacker behavior into a structured catalog so that defenders can identify, discuss, and detect them consistently.

MITRE, a federally funded research organization in the United States, created ATT&CK in 2013 by studying real-world intrusions and documenting the specific actions attackers took. Today the framework catalogs over 200 techniques observed across thousands of incidents. When a security team says "we detected [T1059.001](https://attack.mitre.org/techniques/T1059/001/)," every other team in the world knows they mean someone ran a PowerShell command for malicious purposes --- no further explanation needed.

## The Hierarchy: Tactics, Techniques, Sub-techniques, and Procedures

ATT&CK organizes attacker behavior into four levels. Each level adds specificity, moving from the attacker's abstract goal down to the exact tool they used.

| Level | What It Describes | Analogy | Example |
|-------|-------------------|---------|---------|
| **Tactic** | The attacker's *goal* --- what they are trying to accomplish | A chapter title in the field guide ("Birds of Prey") | **[Credential Access](https://attack.mitre.org/tactics/TA0006/)** (TA0006) --- steal usernames and passwords |
| **Technique** | *How* they accomplish the goal --- the general method | A species entry ("Red-tailed Hawk") | **[T1110 --- Brute Force](https://attack.mitre.org/techniques/T1110/)** --- try many passwords until one works |
| **Sub-technique** | A specific *variant* of the method | A subspecies ("Western Red-tailed Hawk") | **[T1110.001 --- Password Guessing](https://attack.mitre.org/techniques/T1110/001/)** --- try common passwords against known usernames |
| **Procedure** | A *real-world implementation* --- the actual tool or script used | A field sighting with date and location | **Hydra** tool running `hydra -l root -P wordlist.txt ssh://target` |

The hierarchy works like a zoom lens. At the tactic level you see the big picture: the attacker wants credentials. Zoom in to the technique and you see their method: brute force. Zoom further to the sub-technique and you see the variant: password guessing rather than, say, password spraying (trying one password against many accounts). At the procedure level you see the exact tool and command line.

## The ATT&CK Matrix

The full ATT&CK matrix arranges tactics as columns and techniques as rows beneath each tactic. Imagine a spreadsheet where each column header is a goal and each cell underneath is a method for achieving that goal. The table below shows 6 of the 14 tactics --- the ones most relevant to what Seerflow detects in log data.

!!! note "Scope"
    The full ATT&CK matrix has 14 tactics and 200+ techniques. This table highlights 6 of them. Notably, **[Credential Access (TA0006)](https://attack.mitre.org/tactics/TA0006/)** — where our T1110 brute-force example lives — is also covered by Seerflow but omitted here for space. See the [reference glossary](../reference/glossary.md) for complete coverage details.

| [Initial Access (TA0001)](https://attack.mitre.org/tactics/TA0001/) | [Execution (TA0002)](https://attack.mitre.org/tactics/TA0002/) | [Persistence (TA0003)](https://attack.mitre.org/tactics/TA0003/) | [Privilege Escalation (TA0004)](https://attack.mitre.org/tactics/TA0004/) | [Lateral Movement (TA0008)](https://attack.mitre.org/tactics/TA0008/) | [Command & Control (TA0011)](https://attack.mitre.org/tactics/TA0011/) |
|---|---|---|---|---|---|
| [T1190](https://attack.mitre.org/techniques/T1190/) Exploit Public-Facing Application ✅ | [T1059](https://attack.mitre.org/techniques/T1059/) Command and Scripting Interpreter ✅ | [T1136](https://attack.mitre.org/techniques/T1136/) Create Account ✅ | [T1548](https://attack.mitre.org/techniques/T1548/) Abuse Elevation Control Mechanism ✅ | [T1021](https://attack.mitre.org/techniques/T1021/) Remote Services ✅ | [T1071](https://attack.mitre.org/techniques/T1071/) Application Layer Protocol ✅ |
| [T1133](https://attack.mitre.org/techniques/T1133/) External Remote Services ✅ | [T1053](https://attack.mitre.org/techniques/T1053/) Scheduled Task/Job ✅ | [T1098](https://attack.mitre.org/techniques/T1098/) Account Manipulation ✅ | [T1068](https://attack.mitre.org/techniques/T1068/) Exploitation for Privilege Escalation | [T1563](https://attack.mitre.org/techniques/T1563/) Remote Service Session Hijacking | [T1573](https://attack.mitre.org/techniques/T1573/) Encrypted Channel |
| [T1078](https://attack.mitre.org/techniques/T1078/) Valid Accounts ✅ | [T1204](https://attack.mitre.org/techniques/T1204/) User Execution | [T1543](https://attack.mitre.org/techniques/T1543/) Create or Modify System Process ✅ | [T1078](https://attack.mitre.org/techniques/T1078/) Valid Accounts ✅ | [T1550](https://attack.mitre.org/techniques/T1550/) Use Alternate Authentication Material | [T1105](https://attack.mitre.org/techniques/T1105/) Ingress Tool Transfer ✅ |

Techniques marked with ✅ are ones Seerflow can detect through its combination of Sigma rules and ML-based anomaly detection. The unmarked techniques typically require endpoint telemetry (data collected directly from individual computers) rather than the log sources Seerflow ingests.

For complete coverage details, see the [ATT&CK Coverage](../reference/attack-coverage.md) and [Bundled Sigma Rules](../reference/sigma-rules.md) reference pages.

## Two Ways to Read the Matrix

ATT&CK is not just a reference poster for the wall. It is a practical tool that works in two directions.

### Forward: From Log Source to Detectable Techniques

Suppose your organization sends SSH authentication logs (**auth.log**) to Seerflow. You can ask: *what ATT&CK techniques could we detect with this data?* SSH logs reveal failed and successful logins, so they cover techniques like [T1110](https://attack.mitre.org/techniques/T1110/) (Brute Force), [T1078](https://attack.mitre.org/techniques/T1078/) (Valid Accounts used at unusual times), and [T1021.004](https://attack.mitre.org/techniques/T1021/004/) (SSH lateral movement). This forward mapping tells you what value each log source provides.

### Backward: From Threat Intel to Coverage Verification

Now suppose your threat intelligence team (the people who track emerging threats) warns that a ransomware group is using [T1053.005](https://attack.mitre.org/techniques/T1053/005/) (Scheduled Tasks) for persistence. You can ask: *do we have detection coverage for this?*

Seerflow ships with three bundled Sigma rules that detect this technique out of the box:

- **Scheduled task/job creation** --- fires when `crontab`, `at`, or `systemd-run` commands appear in process creation logs
- **Cron file persistence** --- fires when new files are written to `/etc/cron.d/`, `/var/spool/cron/`, or similar directories
- **Crontab file modification** --- fires when existing crontab files are modified

These rules load automatically at startup, so every Seerflow instance has T1053.005 coverage from the first run. The detection happens in real time: the moment a monitored server's logs show a cron job being created, Seerflow's Sigma engine matches the event and fires an alert.

If a future threat requires detection that no bundled rule covers, you can add custom Sigma rules by placing `.yml` files in a directory listed under `detection.sigma_rules_dirs` in your `seerflow.yaml`. This backward mapping turns abstract threat reports into concrete, verifiable action items --- either you already have a rule that fires, or you know exactly what rule to write.

Together, these two directions let you continuously improve your security posture --- the overall readiness of your defenses --- by connecting what you *can* see to what you *need* to see.

## Mapping Our SSH Example

Let's trace our running example through the ATT&CK hierarchy to see how a single log event connects to the broader framework.

The attacker hammered our SSH server with thousands of password attempts. In ATT&CK terms:

1. **Tactic:** [Credential Access (TA0006)](https://attack.mitre.org/tactics/TA0006/) --- the attacker's goal is to steal working credentials
2. **Technique:** [T1110 --- Brute Force](https://attack.mitre.org/techniques/T1110/) --- the method is to try many passwords
3. **Sub-technique:** [T1110.001 --- Password Guessing](https://attack.mitre.org/techniques/T1110/001/) --- the variant involves guessing passwords for a known username (`root`)
4. **Procedure:** The attacker used an automated tool that generated 4,312 failed SSH login attempts from IP `198.51.100.23` over 23 minutes

This mapping does more than label the event. It connects a single noisy log line to a body of knowledge: which threat groups use this technique, what they typically do next, and what other techniques tend to accompany it. For instance, ATT&CK data shows that brute-force attacks ([T1110](https://attack.mitre.org/techniques/T1110/)) are frequently followed by lateral movement ([TA0008](https://attack.mitre.org/tactics/TA0008/)) --- the attacker uses stolen credentials to hop to other machines. That knowledge shapes what Seerflow watches for after detecting the initial attack.

## The Tactic Gap: Not Just Initial Access

You may have noticed that our SSH brute-force example maps to **[Credential Access](https://attack.mitre.org/tactics/TA0006/)** (TA0006), not [Initial Access](https://attack.mitre.org/tactics/TA0001/) (TA0001). This is an important distinction. Initial Access describes how an attacker first gets into your network. Credential Access describes how they steal passwords and keys, which can happen at any stage --- before, during, or after the initial breach. ATT&CK tactics are not sequential steps; they are goals that can occur in any order and repeat throughout an intrusion. The *Cyber Kill Chain*, covered in the next section, provides the sequential model.

!!! info "How Seerflow Uses This"
    Seerflow maps every alert to ATT&CK tactics and techniques, giving you immediate context about what an attacker is trying to accomplish --- not just that something suspicious happened.

    Two systems work together to produce these mappings:

    - **Sigma rules** carry ATT&CK tags directly in their metadata. When a rule fires, its associated tactic and technique IDs come along automatically.
    - **`attack_mapping.py`** uses regex patterns matched against Drain3 log templates (the normalized log patterns extracted during parsing) to assign ATT&CK classifications to ML-generated anomaly alerts that do not originate from Sigma rules.

    Together, these ensure that every alert --- whether from a hand-written rule or a machine learning model --- speaks the common language of ATT&CK.

    **Next:** [Cyber Kill Chain →](kill-chain.md)
