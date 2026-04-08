# Failure Patterns in Logs

Every operational failure leaves a signature in your logs --- a pattern that repeats across incidents, industries, and tech stacks. A database running out of connections looks the same whether you're running a fintech platform or a social media app. A process killed by the kernel's OOM (Out of Memory) killer produces the same syslog line on every Linux host.

Learning to recognize these patterns is the first step toward automated detection. Once you know what a failure *looks like* in log data, you can build systems that spot it in real time --- before a human notices, before customers complain, before the on-call engineer's phone rings.

This section covers six common failure patterns. For each one, you'll see what it is, what the log evidence looks like, and which Seerflow detector catches it.

---

## 1. Error Cascade (500 Error Spike)

An error cascade starts when a single backend dependency fails --- a database goes unreachable, a cache node drops, a certificate expires --- and every request that touches that dependency starts returning HTTP 500 errors. The error rate climbs from background noise to a flood in minutes. If the failing dependency is on the critical path, every API endpoint that depends on it fails simultaneously.

The danger is speed. A healthy API might return errors on 0.1% of requests. When that number jumps to 5%, then 15%, then 40%, the cascade is already well underway. By the time a dashboard refreshes and a human notices, hundreds of users have hit errors.

```json title="Application log (structured JSON)"
{
  "timestamp": "2026-03-15T14:23:07Z",
  "level": "ERROR",
  "service": "api-gateway",
  "status": 500,
  "path": "/api/orders",
  "error": "ConnectionRefusedError: connect ECONNREFUSED 10.0.1.42:5432",
  "request_id": "req-7f3a9b21",
  "duration_ms": 34
}
```

The telltale sign is the error message itself: `ConnectionRefusedError` pointing at port 5432 (PostgreSQL's default). This template has never appeared during normal operations --- and now it's appearing hundreds of times per minute.

**Detector: Half-Space Trees (content anomaly).** HST flags the novel error template `ConnectionRefusedError: connect ECONNREFUSED <*>:<*>` appearing at high frequency. During normal operations, this template sits in a sparse, rarely visited region of HST's feature space. When it suddenly dominates incoming events, the content anomaly score spikes.

---

## 2. Connection Pool Exhaustion

Most applications maintain a **connection pool** --- a fixed set of pre-opened database connections that requests share. When every connection is in use, new requests queue up waiting. If the queue grows faster than connections free up, the pool is exhausted. Queued requests start timing out, and the database itself starts refusing new connections.

This pattern is insidious because it often has no single root cause. A slow query holds connections longer than expected. A traffic spike arrives. A connection leak in new code drains the pool one connection at a time. By the time the database logs a `FATAL`, the application is already in trouble.

```text title="PostgreSQL log"
2026-03-15 14:25:12.341 UTC [1842] FATAL:  remaining connection slots are reserved
  for non-replication superuser connections
```

PostgreSQL reserves a small number of connection slots for superusers so administrators can still connect to diagnose problems. When you see this message, every non-reserved slot is already taken --- the pool is full.

**Detector: Holt-Winters (volume anomaly).** Holt-Winters maintains a forecast of expected connection error volume based on historical trends and seasonal cycles (daily traffic patterns, weekly business rhythms). A sudden burst of `FATAL: remaining connection slots` messages diverges sharply from the seasonal baseline, triggering a volume anomaly flag.

---

## 3. OOM Kill

When a process consumes more memory than the system can provide, the Linux kernel's **OOM killer** steps in and terminates it. This is a last resort --- the kernel has already exhausted swap space and cannot reclaim memory any other way. The killed process gets no warning and no chance to clean up. It simply stops.

OOM kills are especially dangerous in containerized environments. A Kubernetes pod with a memory limit of 512 MiB might run fine for hours, then hit a spike --- a large request, a cache that grows without bounds, a memory leak that compounds over time --- and get killed instantly.

```text title="Syslog (kernel)"
Mar 15 14:31:47 web-prod-01 kernel: [42156.789] Out of memory: Killed process 3847 (node)
  total-vm:1048576kB, anon-rss:524288kB, file-rss:0kB, shmem-rss:0kB
```

```yaml title="Kubernetes event"
type: Warning
reason: OOMKilled
message: "Container api-server in pod api-server-7d4f8b exceeded memory limit (512Mi)"
lastTimestamp: "2026-03-15T14:31:48Z"
```

The syslog line tells you what the kernel did. The Kubernetes event tells you which container was affected and what the limit was. Together, they confirm an OOM kill.

**Detectors: HST + CUSUM.** Two detectors collaborate here. **HST** flags the rare template --- `Out of memory: Killed process` is a message that should almost never appear, so it sits deep in sparse feature space. **CUSUM** (Cumulative Sum) adds a second signal by detecting the *trend change point* in memory usage that preceded the kill. Memory consumption was climbing steadily for hours before the final spike. CUSUM catches that sustained upward shift in the mean, often well before the OOM kill actually fires.

---

## 4. Disk Pressure

Filesystems fill up slowly, then fail suddenly. A log directory grows a few gigabytes per day. A database's WAL (Write-Ahead Log) accumulates because a replica fell behind. Temporary files from a batch job pile up because nobody added cleanup logic. Whatever the cause, once the filesystem crosses a critical threshold, writes start failing --- and anything that depends on writing (logging, database transactions, temp files) breaks.

The log evidence often appears as kernel-level filesystem warnings, well before the disk is completely full.

```text title="Syslog (kernel)"
Mar 15 09:44:21 db-prod-01 kernel: EXT4-fs warning (device sda1):
  ext4_dx_add_entry:2449: Directory (ino: 2) index full, reach max htree level :2
```

This EXT4 warning means a directory has hit its maximum entry count --- a symptom of runaway file creation that signals disk pressure is mounting. Soon after, you'll see write failures and application errors.

**Detector: Holt-Winters (trend detection).** Holt-Winters decomposes disk-related event volume into three components: baseline level, trend (growth rate), and seasonal cycle. When disk warning messages grow faster than the weekly pattern predicts --- say, doubling every day instead of the expected flat baseline --- the trend component diverges and triggers an anomaly. This catches the *acceleration* of the problem, not just the current state.

---

## 5. Dependency Timeout

Modern services depend on other services. When an upstream dependency stops responding --- a payment provider goes down, an internal API hits a deadlock, a DNS resolver stalls --- the calling service waits for a response that never comes. After the timeout period (often 30 seconds), it logs a timeout error. If retries are configured, it tries again. And again.

The result is a log full of timeout warnings, each representing a request that held a thread or connection hostage for the full timeout duration. The calling service's capacity drains as threads pile up waiting on a dependency that isn't coming back.

```json title="Application log (structured JSON)"
{
  "timestamp": "2026-03-15T14:28:44Z",
  "level": "WARN",
  "service": "checkout-service",
  "message": "Request to payment-api timed out after 30000ms",
  "target": "https://payment-api.internal/charge",
  "attempt": 3,
  "trace_id": "abc-123-def"
}
```

Three attempts, 30 seconds each --- this single request consumed 90 seconds of thread time before giving up. Multiply that by every checkout request in the queue.

**Detector: Markov Chains (sequence anomaly).** Markov Chains learn the typical order of events for each service. The normal sequence for `checkout-service` is `request` then `response` then `next_step`. During a dependency timeout, the sequence becomes `request` then `timeout` then `retry` then `timeout` then `retry` then `timeout` --- a pattern the model has never observed in normal operations. The transition probability from `request` to `timeout` was near zero; now it's dominant. The sequence anomaly score climbs sharply.

---

## 6. Retry Storm / Cascading Failure

A retry storm happens when a slow or failing service causes its callers to retry, and those retries amplify load on the already-struggling service --- which slows down further, causing more retries. The feedback loop can pull in services that had nothing wrong with them. A single slow database query can cascade into a cluster-wide outage.

The log evidence spans multiple services. No single service's logs tell the full story.

```json title="checkout-service log"
{
  "timestamp": "2026-03-15T14:29:01Z",
  "level": "WARN",
  "service": "checkout-service",
  "message": "Retrying request to inventory-service (attempt 4/5)",
  "target": "https://inventory-service.internal/reserve",
  "reason": "504 Gateway Timeout"
}
```

```json title="inventory-service log"
{
  "timestamp": "2026-03-15T14:29:01Z",
  "level": "ERROR",
  "service": "inventory-service",
  "message": "Request queue depth exceeded threshold",
  "queue_depth": 847,
  "max_queue": 200,
  "p99_latency_ms": 12400
}
```

```json title="order-service log"
{
  "timestamp": "2026-03-15T14:29:03Z",
  "level": "ERROR",
  "service": "order-service",
  "message": "Failed to create order: upstream dependency unavailable",
  "failed_dependency": "checkout-service",
  "error": "TimeoutError"
}
```

Three services, three log streams, one cascade. `checkout-service` retries against `inventory-service`, flooding it with 4x the normal request volume. `inventory-service` buckles under the amplified load (queue depth 847, four times its limit). `order-service` --- which depends on `checkout-service`, not `inventory-service` --- fails as collateral damage.

**Detector: Entity graph correlation.** No single detector catches this, because no single service's logs contain the full picture. Seerflow's entity graph connects these services through shared infrastructure entities: the `inventory-service` endpoint appears in both `checkout-service` and `inventory-service` logs. The `checkout-service` endpoint appears in `order-service` logs. When anomaly scores rise on all three services within the same time window, and the entity graph shows they're connected through dependency edges, Seerflow correlates them into a single cascading failure alert --- identifying `inventory-service` as the root cause based on which node's anomalies appeared first.

---

!!! info "How Seerflow Uses This"

    Seerflow's four operational detectors --- **Half-Space Trees**, **Holt-Winters**, **CUSUM**, and **Markov Chains** --- run in parallel on every log event. Each detector specializes in a different failure signal:

    - **HST** catches *what* is unusual (content: error messages, templates, field values)
    - **Holt-Winters** catches *how much* is unusual (volume: spikes, drops, trend divergence)
    - **CUSUM** catches *when things shifted* (change points: sustained mean changes in any metric)
    - **Markov Chains** catch *what order* is unusual (sequence: events arriving in unexpected progression)

    When multiple detectors fire on related events, signal amplification pushes the blended anomaly score higher. A novel error template (HST) appearing during a volume spike (Holt-Winters) at the same time as a trend change (CUSUM) produces a blended score far higher than any single signal alone. DSPOT auto-thresholds then determine whether the combined score warrants an alert.

    For the full algorithm details, see the [Detection section &rarr;](../detection/index.md).

    In our deployment scenario --- the v2.3.1 release from the introduction --- the first sign is an error cascade. HTTP 500 errors climb from 1% to 8% within minutes of the new version rolling out. Let's see what happens next.

    **Next:** [The Deployment Risk Window &rarr;](deployment-risk.md)
