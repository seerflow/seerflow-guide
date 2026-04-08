# Bundled Sigma Rules

Seerflow ships with **63 bundled Sigma rules** from [SigmaHQ](https://github.com/SigmaHQ/sigma) that load automatically at startup. These rules cover Linux, network, web, DNS, and process log sources.

Operators can add custom rules by placing `.yml` files in directories listed under `detection.sigma_rules_dirs` in `seerflow.yaml`.

## Rules by Category

### DNS (7 rules)

| Rule | Severity | ATT&CK Techniques |
|------|----------|-------------------|
| DNS Query to External Service Interaction Domains | high | [T1190](https://attack.mitre.org/techniques/T1190/), [T1595.002](https://attack.mitre.org/techniques/T1595/002/) |
| Cobalt Strike DNS Beaconing | critical | [T1071.004](https://attack.mitre.org/techniques/T1071/004/) |
| Monero Crypto Coin Mining Pool Lookup | high | [T1496](https://attack.mitre.org/techniques/T1496/), [T1567](https://attack.mitre.org/techniques/T1567/) |
| Suspicious DNS Query with B64 Encoded String | medium | [T1048.003](https://attack.mitre.org/techniques/T1048/003/), [T1071.004](https://attack.mitre.org/techniques/T1071/004/) |
| Telegram Bot API Request | medium | [T1102.002](https://attack.mitre.org/techniques/T1102/002/) |
| DNS TXT Answer with Possible Execution Strings | high | [T1071.004](https://attack.mitre.org/techniques/T1071/004/) |
| Wannacry Killswitch Domain | high | [T1071.001](https://attack.mitre.org/techniques/T1071/001/) |

### Linux (16 rules)

| Rule | Severity | ATT&CK Techniques |
|------|----------|-------------------|
| Persistence Via Cron Files | medium | [T1053.003](https://attack.mitre.org/techniques/T1053/003/) |
| Persistence Via Sudoers Files | medium | [T1053.003](https://attack.mitre.org/techniques/T1053/003/) |
| Creation Of An User Account | medium | [T1136.001](https://attack.mitre.org/techniques/T1136/001/) |
| Logging Configuration Changes on Linux Host | high | [T1562.006](https://attack.mitre.org/techniques/T1562/006/) |
| Systemd Service Creation | medium | [T1543.002](https://attack.mitre.org/techniques/T1543/002/) |
| Unix Shell Configuration Modification | medium | [T1546.004](https://attack.mitre.org/techniques/T1546/004/) |
| Buffer Overflow Attempts | high | [T1068](https://attack.mitre.org/techniques/T1068/) |
| Relevant ClamAV Message | high | [T1588.001](https://attack.mitre.org/techniques/T1588/001/) |
| Commands to Clear or Remove the Syslog | high | [T1565.001](https://attack.mitre.org/techniques/T1565/001/) |
| Modifying Crontab | medium | [T1053.003](https://attack.mitre.org/techniques/T1053/003/) |
| Code Injection by ld.so Preload | high | [T1574.006](https://attack.mitre.org/techniques/T1574/006/) |
| Privileged User Has Been Created | high | [T1136.001](https://attack.mitre.org/techniques/T1136/001/), [T1098](https://attack.mitre.org/techniques/T1098/) |
| Linux Command History Tampering | high | [T1070.003](https://attack.mitre.org/techniques/T1070/003/) |
| Shellshock Expression | high | [T1505.003](https://attack.mitre.org/techniques/T1505/003/) |
| Suspicious OpenSSH Daemon Error | medium | [T1190](https://attack.mitre.org/techniques/T1190/) |
| Disabling Security Tools | medium | [T1562.004](https://attack.mitre.org/techniques/T1562/004/) |

### Network (6 rules)

| Rule | Severity | ATT&CK Techniques |
|------|----------|-------------------|
| Linux Reverse Shell Indicator | critical | [T1059.004](https://attack.mitre.org/techniques/T1059/004/) |
| Linux Crypto Mining Pool Connections | high | [T1496](https://attack.mitre.org/techniques/T1496/) |
| Communication To LocaltoNet Tunneling Service | high | [T1572](https://attack.mitre.org/techniques/T1572/), [T1090](https://attack.mitre.org/techniques/T1090/) |
| Communication To Ngrok Tunneling Service | high | [T1567](https://attack.mitre.org/techniques/T1567/), [T1572](https://attack.mitre.org/techniques/T1572/) |
| Potentially Suspicious Malware Callback Communication | high | [T1571](https://attack.mitre.org/techniques/T1571/) |
| Cleartext Protocol Usage | low | --- |

### Process (20 rules)

| Rule | Severity | ATT&CK Techniques |
|------|----------|-------------------|
| Linux Base64 Encoded Pipe to Shell | medium | [T1140](https://attack.mitre.org/techniques/T1140/) |
| Linux Base64 Encoded Shebang In CLI | medium | [T1140](https://attack.mitre.org/techniques/T1140/) |
| Clear Linux Logs | medium | [T1070.002](https://attack.mitre.org/techniques/T1070/002/) |
| Copy Passwd Or Shadow From TMP Path | high | [T1552.001](https://attack.mitre.org/techniques/T1552/001/) |
| Linux Crypto Mining Indicators | high | [T1496](https://attack.mitre.org/techniques/T1496/) |
| Shell Execution via Find | high | [T1083](https://attack.mitre.org/techniques/T1083/) |
| Potential Netcat Reverse Shell Execution | high | [T1059](https://attack.mitre.org/techniques/T1059/) |
| Potential Perl Reverse Shell Execution | high | --- |
| Potential PHP Reverse Shell | high | --- |
| Python Reverse Shell Execution | high | --- |
| Potential Ruby Reverse Shell | medium | --- |
| Scheduled Cron Task/Job | medium | [T1053.003](https://attack.mitre.org/techniques/T1053/003/) |
| History File Deletion | high | [T1565.001](https://attack.mitre.org/techniques/T1565/001/) |
| Linux HackTool Execution | high | [T1587](https://attack.mitre.org/techniques/T1587/) |
| Suspicious Java Children Processes | high | [T1059](https://attack.mitre.org/techniques/T1059/) |
| Linux Shell Pipe to Shell | medium | [T1140](https://attack.mitre.org/techniques/T1140/) |
| Linux System Information Discovery | low | [T1033](https://attack.mitre.org/techniques/T1033/), [T1082](https://attack.mitre.org/techniques/T1082/) |
| Vim GTFOBin Abuse | high | [T1083](https://attack.mitre.org/techniques/T1083/) |
| Linux Webshell Indicators | high | [T1505.003](https://attack.mitre.org/techniques/T1505/003/) |
| Potential Xterm Reverse Shell | medium | [T1059](https://attack.mitre.org/techniques/T1059/) |

### Web (10 rules)

| Rule | Severity | ATT&CK Techniques |
|------|----------|-------------------|
| Java Payload Strings | high | [T1190](https://attack.mitre.org/techniques/T1190/) |
| JNDIExploit Pattern | high | [T1190](https://attack.mitre.org/techniques/T1190/) |
| Path Traversal Exploitation Attempts | medium | [T1190](https://attack.mitre.org/techniques/T1190/) |
| Source Code Enumeration Detection | medium | [T1083](https://attack.mitre.org/techniques/T1083/) |
| SQL Injection Strings In URI | high | [T1190](https://attack.mitre.org/techniques/T1190/) |
| Server Side Template Injection Strings | high | [T1221](https://attack.mitre.org/techniques/T1221/) |
| Suspicious User-Agents Related To Recon Tools | medium | [T1190](https://attack.mitre.org/techniques/T1190/) |
| Suspicious Windows Strings In URI | high | [T1505.003](https://attack.mitre.org/techniques/T1505/003/) |
| Webshell ReGeorg Detection Via Web Logs | high | [T1505.003](https://attack.mitre.org/techniques/T1505/003/) |
| Cross Site Scripting Strings | high | [T1189](https://attack.mitre.org/techniques/T1189/) |

## Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 40 |
| Medium | 18 |
| Low | 3 |
