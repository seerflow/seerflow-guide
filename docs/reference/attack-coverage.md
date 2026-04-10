# ATT&CK Coverage

This page maps Seerflow's detection capabilities to the [MITRE ATT&CK](https://attack.mitre.org/) framework. Coverage comes from two sources: **Sigma rules** (pattern-based) and **ML anomaly detection** (behavior-based).

!!! example "Interactive: explore Seerflow's ATT&CK coverage"

    <div class="seerflow-viz"
         data-viz="attack-heatmap"
         data-src="../assets/viz-data/attack-matrix.json"
         data-caption="MITRE ATT&CK techniques covered by Seerflow. Hover for technique details; click a cell to jump to the relevant guide section."
         style="min-height: 600px;"></div>

## Coverage by Tactic

| Tactic | Sigma Rules | ML Coverage | Total Techniques Covered |
|--------|------------|-------------|-------------------------|
| [Reconnaissance (TA0043)](https://attack.mitre.org/tactics/TA0043/) | --- | Anomaly on scan patterns | Partial |
| [Resource Development (TA0042)](https://attack.mitre.org/tactics/TA0042/) | 1 (T1588) | --- | 1 |
| [Initial Access (TA0001)](https://attack.mitre.org/tactics/TA0001/) | 8 (T1190, T1133, T1078, T1189) | Brute-force detection | 4 |
| [Execution (TA0002)](https://attack.mitre.org/tactics/TA0002/) | 12 (T1059, T1053, T1204) | Unusual command sequences | 3 |
| [Persistence (TA0003)](https://attack.mitre.org/tactics/TA0003/) | 10 (T1136, T1098, T1543, T1053, T1546) | --- | 5 |
| [Privilege Escalation (TA0004)](https://attack.mitre.org/tactics/TA0004/) | 5 (T1548, T1068, T1574) | Unusual privilege patterns | 3 |
| [Defense Evasion (TA0005)](https://attack.mitre.org/tactics/TA0005/) | 6 (T1562, T1070, T1140) | --- | 3 |
| [Credential Access (TA0006)](https://attack.mitre.org/tactics/TA0006/) | 2 (T1552) | Brute-force, credential stuffing | 2 |
| [Discovery (TA0007)](https://attack.mitre.org/tactics/TA0007/) | 3 (T1033, T1082, T1083) | --- | 3 |
| [Lateral Movement (TA0008)](https://attack.mitre.org/tactics/TA0008/) | 1 (T1021) | Graph correlation | 1 |
| [Collection (TA0009)](https://attack.mitre.org/tactics/TA0009/) | --- | Volume anomaly | Partial |
| [Command and Control (TA0011)](https://attack.mitre.org/tactics/TA0011/) | 9 (T1071, T1572, T1090, T1102, T1105) | Beaconing detection | 5 |
| [Exfiltration (TA0010)](https://attack.mitre.org/tactics/TA0010/) | 2 (T1048, T1567) | Volume anomaly | 2 |
| [Impact (TA0040)](https://attack.mitre.org/tactics/TA0040/) | 3 (T1496, T1565) | --- | 2 |

## Most Covered Techniques

These techniques have the strongest detection coverage (multiple rules and/or ML models):

| Technique | Rules | ML Models |
|-----------|-------|-----------|
| [T1059 Command and Scripting Interpreter](https://attack.mitre.org/techniques/T1059/) | 8 rules (bash, netcat, perl, PHP, python, ruby, xterm, java) | Markov chain (unusual command sequences) |
| [T1190 Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/) | 7 rules (SQLi, SSTI, path traversal, JNDI, recon UA) | Half-Space Trees (rare request patterns) |
| [T1505.003 Web Shell](https://attack.mitre.org/techniques/T1505/003/) | 4 rules (shellshock, ReGeorg, webshell indicators, Windows strings) | --- |
| [T1053.003 Cron](https://attack.mitre.org/techniques/T1053/003/) | 4 rules (cron files, crontab, scheduled task, sudoers) | --- |
| [T1071 Application Layer Protocol](https://attack.mitre.org/techniques/T1071/) | 4 rules (DNS beaconing, DNS TXT, Wannacry, B64 queries) | Markov chain (unusual DNS patterns) |
| [T1496 Resource Hijacking](https://attack.mitre.org/techniques/T1496/) | 3 rules (mining pool DNS, mining connections, mining processes) | Volume anomaly (CPU/network spike) |
| [T1140 Deobfuscate/Decode](https://attack.mitre.org/techniques/T1140/) | 3 rules (base64 pipe, base64 shebang, shell pipe) | --- |

## Known Gaps

These commonly targeted techniques are **not currently covered** by bundled rules. Coverage requires either custom Sigma rules or endpoint telemetry that Seerflow does not currently ingest:

| Technique | Why Not Covered |
|-----------|----------------|
| [T1055 Process Injection](https://attack.mitre.org/techniques/T1055/) | Requires endpoint agent (EDR) telemetry |
| [T1003 OS Credential Dumping](https://attack.mitre.org/techniques/T1003/) | Requires Windows event logs or EDR |
| [T1027 Obfuscated Files](https://attack.mitre.org/techniques/T1027/) | Requires file analysis, not log-based |
| [T1486 Data Encrypted for Impact](https://attack.mitre.org/techniques/T1486/) | Ransomware detection requires file system monitoring |

These gaps are expected for a log-based SIEM. Organizations needing coverage for these techniques should complement Seerflow with an endpoint detection agent (EDR).
