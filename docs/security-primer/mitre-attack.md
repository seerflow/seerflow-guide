# MITRE ATT&CK Framework

In the previous section, we saw an attacker try thousands of SSH passwords. Security researchers have a name for this: **T1110 --- Brute Force**. That identifier comes from a framework called MITRE ATT&CK, and it is the closest thing the cybersecurity industry has to a universal language for describing what attackers do.

## A Field Guide to Attacker Behavior

Think of ATT&CK (Adversarial Tactics, Techniques, and Common Knowledge) as a field guide to wildlife, except the wildlife is malicious. A birdwatcher's guide organizes species by habitat, appearance, and behavior so you can identify what you are looking at in the field. ATT&CK does the same thing for cyberattacks: it organizes every known attacker behavior into a structured catalog so that defenders can identify, discuss, and detect them consistently.

MITRE, a federally funded research organization in the United States, created ATT&CK in 2013 by studying real-world intrusions and documenting the specific actions attackers took. Today the framework catalogs over 200 techniques observed across thousands of incidents. When a security team says "we detected T1059.001," every other team in the world knows they mean someone ran a PowerShell command for malicious purposes --- no further explanation needed.

## The Hierarchy: Tactics, Techniques, Sub-techniques, and Procedures

ATT&CK organizes attacker behavior into four levels. Each level adds specificity, moving from the attacker's abstract goal down to the exact tool they used.

| Level | What It Describes | Analogy | Example |
|-------|-------------------|---------|---------|
| **Tactic** | The attacker's *goal* --- what they are trying to accomplish | A chapter title in the field guide ("Birds of Prey") | **Credential Access** (TA0006) --- steal usernames and passwords |
| **Technique** | *How* they accomplish the goal --- the general method | A species entry ("Red-tailed Hawk") | **T1110 --- Brute Force** --- try many passwords until one works |
| **Sub-technique** | A specific *variant* of the method | A subspecies ("Western Red-tailed Hawk") | **T1110.001 --- Password Guessing** --- try common passwords against known usernames |
| **Procedure** | A *real-world implementation* --- the actual tool or script used | A field sighting with date and location | **Hydra** tool running `hydra -l root -P wordlist.txt ssh://target` |

The hierarchy works like a zoom lens. At the tactic level you see the big picture: the attacker wants credentials. Zoom in to the technique and you see their method: brute force. Zoom further to the sub-technique and you see the variant: password guessing rather than, say, password spraying (trying one password against many accounts). At the procedure level you see the exact tool and command line.

## The ATT&CK Matrix

The full ATT&CK matrix arranges tactics as columns and techniques as rows beneath each tactic. Imagine a spreadsheet where each column header is a goal and each cell underneath is a method for achieving that goal. The table below shows 6 of the 14 tactics --- the ones most relevant to what Seerflow detects in log data.

!!! note "Scope"
    The full ATT&CK matrix has 14 tactics and 200+ techniques. This table highlights the 6 tactics most relevant to Seerflow's detection capabilities.

| Initial Access (TA0001) | Execution (TA0002) | Persistence (TA0003) | Privilege Escalation (TA0004) | Lateral Movement (TA0008) | Command & Control (TA0011) |
|---|---|---|---|---|---|
| T1190 Exploit Public-Facing Application ✅ | T1059 Command and Scripting Interpreter ✅ | T1136 Create Account ✅ | T1548 Abuse Elevation Control Mechanism ✅ | T1021 Remote Services ✅ | T1071 Application Layer Protocol ✅ |
| T1133 External Remote Services ✅ | T1053 Scheduled Task/Job ✅ | T1098 Account Manipulation ✅ | T1068 Exploitation for Privilege Escalation | T1563 Remote Service Session Hijacking | T1573 Encrypted Channel |
| T1078 Valid Accounts ✅ | T1204 User Execution | T1543 Create or Modify System Process ✅ | T1078 Valid Accounts ✅ | T1550 Use Alternate Authentication Material | T1105 Ingress Tool Transfer ✅ |

Techniques marked with ✅ are ones Seerflow can detect through its combination of Sigma rules and ML-based anomaly detection. The unmarked techniques typically require endpoint telemetry (data collected directly from individual computers) rather than the log sources Seerflow ingests.

## Two Ways to Read the Matrix

ATT&CK is not just a reference poster for the wall. It is a practical tool that works in two directions.

### Forward: From Log Source to Detectable Techniques

Suppose your organization sends SSH authentication logs (**auth.log**) to Seerflow. You can ask: *what ATT&CK techniques could we detect with this data?* SSH logs reveal failed and successful logins, so they cover techniques like T1110 (Brute Force), T1078 (Valid Accounts used at unusual times), and T1021.004 (SSH lateral movement). This forward mapping tells you what value each log source provides.

### Backward: From Threat Intel to Coverage Verification

Now suppose your threat intelligence team (the people who track emerging threats) warns that a ransomware group is using T1053.005 (Scheduled Tasks) for persistence. You can ask: *do we have detection coverage for this?* If Seerflow has a Sigma rule or anomaly detector that fires on cron job (a scheduled recurring command on Linux systems) creation events, you are covered. If not, you have a gap to address. This backward mapping turns abstract threat reports into concrete action items.

Together, these two directions let you continuously improve your security posture --- the overall readiness of your defenses --- by connecting what you *can* see to what you *need* to see.

## Mapping Our SSH Example

Let's trace our running example through the ATT&CK hierarchy to see how a single log event connects to the broader framework.

The attacker hammered our SSH server with thousands of password attempts. In ATT&CK terms:

1. **Tactic:** Credential Access (TA0006) --- the attacker's goal is to steal working credentials
2. **Technique:** T1110 --- Brute Force --- the method is to try many passwords
3. **Sub-technique:** T1110.001 --- Password Guessing --- the variant involves guessing passwords for a known username (`root`)
4. **Procedure:** The attacker used an automated tool that generated 4,312 failed SSH login attempts from IP `198.51.100.47` over 23 minutes

This mapping does more than label the event. It connects a single noisy log line to a body of knowledge: which threat groups use this technique, what they typically do next, and what other techniques tend to accompany it. For instance, ATT&CK data shows that brute-force attacks (T1110) are frequently followed by lateral movement (TA0008) --- the attacker uses stolen credentials to hop to other machines. That knowledge shapes what Seerflow watches for after detecting the initial attack.

## The Tactic Gap: Not Just Initial Access

You may have noticed that our SSH brute-force example maps to **Credential Access** (TA0006), not Initial Access (TA0001). This is an important distinction. Initial Access describes how an attacker first gets into your network. Credential Access describes how they steal passwords and keys, which can happen at any stage --- before, during, or after the initial breach. ATT&CK tactics are not sequential steps; they are goals that can occur in any order and repeat throughout an intrusion. The *Cyber Kill Chain*, covered in the next section, provides the sequential model.

!!! info "How Seerflow Uses This"
    Seerflow maps every alert to ATT&CK tactics and techniques, giving you immediate context about what an attacker is trying to accomplish --- not just that something suspicious happened.

    Two systems work together to produce these mappings:

    - **Sigma rules** carry ATT&CK tags directly in their metadata. When a rule fires, its associated tactic and technique IDs come along automatically.
    - **`attack_mapping.py`** uses regex patterns matched against Drain3 log templates (the normalized log patterns extracted during parsing) to assign ATT&CK classifications to ML-generated anomaly alerts that do not originate from Sigma rules.

    Together, these ensure that every alert --- whether from a hand-written rule or a machine learning model --- speaks the common language of ATT&CK.

    **Next:** [Cyber Kill Chain →](kill-chain.md)
