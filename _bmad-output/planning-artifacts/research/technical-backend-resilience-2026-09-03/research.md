---
title: 'Technical Research: Backend Application Resilience & Production Pitfalls'
type: 'technical'
topic: 'Backend Application Resilience & Production Pitfalls'
decision: 'Establish comprehensive resilience patterns across HTTP, DB, Storage, and AI layers for Daily Mind & Mood Journal'
source: 'context7 documentation & node/fastify/postgres production post-mortems'
status: final
preset: standard
validation: verified
created: '2026-09-03'
updated: '2026-09-03'
---

# Technical Research: Backend Application Resilience & Production Pitfalls

**Decision this research serves:** Ground the Product Requirements Document (PRD) and subsequent stories in comprehensive resilience patterns that guard against common production failure modes in modern Node.js/PostgreSQL/Azure backend architectures.

---

## Executive Summary

Backend systems fail in predictable ways: database connection pool saturation, unhandled process terminations dropping inflight transactions, runaway memory from unstreamed file uploads, cascading timeouts when external APIs hang, missing rate limits enabling credential stuffing, and sensitive credential leaks in logs or client-facing 500 error envelopes.

This technical research systematically examines these failure modes within our chosen stack (**Node.js 22 LTS**, **Fastify 5**, **Drizzle ORM**, **PostgreSQL / pg**, and **Azure Blob Storage**) and documents verified, minimal-overhead solutions validated through **Context7** live documentation.

---

## 1. Database Connection & Resource Safety

### Failure Modes Observed in Production
1. **Pool Starvation:** Long-running queries or unclosed client connections exhaust the `pg.Pool`, causing all subsequent requests to queue indefinitely until the HTTP server times out.
2. **Missing Statement Timeouts:** A complex sequential scan or deadlock holds locks indefinitely, preventing auto-vacuum and pinning database CPU to 100%.
3. **Connection Leaks on Error:** Exceptions thrown inside manual transaction blocks without proper rollback/release mechanisms leave orphaned sessions.

### Architecture & Library Patterns (Drizzle ORM + pg)
- **Bounded Pool Sizing:** Configure `pg.Pool` explicitly:
  ```ts
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,                          // Hard upper limit on connections
    idleTimeoutMillis: 10000,         // Release idle connections after 10s
    connectionTimeoutMillis: 5000,   // Fail fast if pool cannot acquire client in 5s
    statement_timeout: 3000          // Terminate any query taking >3000ms
  });
  ```
- **Managed Transactions:** Utilize Drizzle's native `db.transaction(async (tx) => { ... })` which automatically issues `COMMIT` on return or `ROLLBACK` on exception.
- **Strict Indexing & Query Guardrails:** Every query filtering by `user_id` or `entry_date` must hit explicit B-tree indexes. Default pagination limit `LIMIT = 20`, hard cap `MAX_LIMIT = 50`.

---

## 2. Process Lifecycle & Graceful Shutdown

### Failure Modes Observed in Production
1. **Hard Kills During Deployment:** Deployments or container restarts trigger `SIGTERM`. If the process exits immediately (`process.exit(0)`), in-flight user requests are terminated with `502 Bad Gateway`, and active database writes are truncated.
2. **Uncaught Rejections Crashing the Event Loop:** Unhandled promise rejections crashing Node.js without releasing sockets or flushing logging buffers.

### Architecture & Fastify Patterns
- **Fastify Lifecycle Hooks (`fastify.close()`):**
  Fastify manages connection draining natively. Upon receiving `SIGTERM` or `SIGINT`:
  1. The server stops accepting new connections (`listening = false`).
  2. In-flight requests are allowed a drain window (e.g. 10 seconds).
  3. Registered `onClose` hooks are executed in child-to-parent order to close DB pools and flush Pino log streams.
- **Signal Handler Implementation:**
  ```ts
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.once(signal, async () => {
      app.log.info({ signal }, 'Received shutdown signal. Starting graceful teardown...');
      try {
        await app.close(); // Triggers connection draining and onClose hooks
        app.log.info('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during graceful shutdown. Forcing exit.');
        process.exit(1);
      }
    });
  }
  ```

---

## 3. Memory Safety & Request Payload Controls

### Failure Modes Observed in Production
1. **OOM via Large File Uploads:** Buffering entire photo uploads in Node.js RAM (`Buffer.from(...)`) quickly crashes the process under concurrent uploads.
2. **Denial-of-Service via Giant JSON Payloads:** Malicious or oversized JSON payloads causing excessive event-loop serialization latency.

### Architecture & Fastify Patterns
- **Strict JSON Body Limit:** Fastify default or configured `bodyLimit: 1048576` (1 MB) for standard JSON endpoints.
- **Streaming Multipart Directly to Azure Blob Storage:**
  Utilize `@fastify/multipart` to parse multipart streams without in-memory buffering. Stream binary chunks directly to Azure Blob Storage via `@azure/storage-blob`'s `uploadStream`:
  ```ts
  // Enforce multipart constraints:
  fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB maximum for photo of the day
      files: 1,                    // Only 1 photo per daily entry
      parts: 10
    }
  });
  ```

---

## 4. API Security, Rate Limiting & Abuse Prevention

### Failure Modes Observed in Production
1. **Brute Force & Credential Stuffing:** Lack of rate limiting on `/api/auth/login` and `/api/auth/register` allows automated password dictionary attacks.
2. **Information Disclosure via Missing Security Headers:** Missing MIME-type sniffing protection, frameguard, or CSP allowing clickjacking and cross-site scripting.
3. **Broken Object Level Authorization (BOLA/IDOR):** Endpoints trusting user IDs supplied in request parameters or payloads instead of the verified JWT identity.

### Architecture & Fastify Patterns
- **Layered Rate Limiting (`@fastify/rate-limit`):**
  - Global tier: 100 requests / minute per IP.
  - Auth tier (`/api/auth/*`): 5 requests / minute per IP with custom 429 error response (`Retry-After`).
- **Security Headers (`@fastify/helmet`):** Standard security headers applied globally (disables `X-Powered-By`, enables `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`).
- **Strict Tenant Scoping:** Route handlers must extract `userId` strictly from `request.user` (verified JWT) and pass it directly to domain operations. Queries enforce `WHERE id = :entryId AND user_id = :userId`.

---

## 5. Structured Observability, Tracing & Data Redaction

### Failure Modes Observed in Production
1. **Leaking Stack Traces & Secrets:** Returning raw error objects or stack traces in HTTP 500 responses leaks database schemas, credentials, or filesystem paths to clients.
2. **Uncorrelated Logs:** Disjointed log lines make it impossible to track a single failing request across handlers and database operations.
3. **PII and Token Leakage in Logs:** Printing raw request headers or bodies exposes JWT tokens and passwords in log aggregation tools.

### Architecture & Fastify Patterns
- **Pino Structured Logging with UUID Request Tracing:**
  Fastify provides built-in Pino integration. Configure UUID generation for correlation:
  ```ts
  const app = Fastify({
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.body.password']
    }
  });
  ```
- **Standardized Error Envelope (`fastify.setErrorHandler`):**
  Uniform error format:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable message"
    }
  }
  ```
  Internal error details are logged server-side with the `req.id`; the client receives a sanitized error without stack traces in production.

---

## 6. Observability: Dual Health Checks (Liveness vs. Readiness)

### Failure Modes Observed in Production
1. **False Positives in Orchestration:** A single `/health` endpoint returning 200 OK while the database is disconnected causes traffic to be routed to a dead container.
2. **Premature Container Restarts:** Readiness checks that kill containers during transient DB spikes instead of merely taking them out of traffic routing.

### Architecture Pattern
- **`/health/live` (Liveness Probe):** Lightweight check verifying that the Node.js process and HTTP event loop are responsive. Returns HTTP 200 `{ "status": "ok" }`.
- **`/health/ready` (Readiness Probe):** Validates that all critical downstream dependencies are reachable:
  - Executes `SELECT 1` via PostgreSQL connection pool.
  - Validates Azure Blob Storage container accessibility.
  - If any dependency fails, returns HTTP 503 `{ "status": "unhealthy", "checks": { "db": false, "storage": true } }`.

---

## 7. External Service (LLM) Resilience & Graceful Degradation

### Failure Modes Observed in Production
1. **Indefinite Hangs:** LLM API network connection drops or stalls, keeping HTTP requests alive until client timeout.
2. **Rate Limits (HTTP 429) & Transient Outages:** External AI API encounters spike errors, crashing the journal platform.
3. **Hallucinated / Malformed Analytics:** Relying on LLMs to perform mathematical aggregations results in incorrect trends and unverified insights.

### Architecture Pattern
- **Deterministic Two-Phase Analysis:**
  All mathematical and statistical trend calculations (mood averages, activity correlations) are computed deterministically in pure TypeScript domain services with 100% unit test coverage.
- **Resilient LLM Client Adapter:**
  - Enforce timeout via `AbortSignal.timeout(15000)`.
  - Implement retry with exponential backoff and jitter (max 3 retries) for 429/503 responses.
  - **Graceful Degradation:** If LLM call fails, the journal platform returns computed deterministic statistics directly with a notification that AI narrative synthesis is temporarily unavailable. Core journal CRUD is never blocked by AI downtime.

---

## Summary of PRD Requirements Derived from Research

| Dimension | Concrete PRD Invariant / Requirement |
| --- | --- |
| **NFR-REL-1** | Database Pool Safety: max 20 connections, 3000ms statement timeout, 5000ms acquire timeout |
| **NFR-REL-2** | Graceful Teardown: `SIGTERM`/`SIGINT` draining inflight requests within 10s before closing DB pool |
| **NFR-REL-3** | Memory & Payload Safety: 1MB JSON body limit, 10MB streaming multipart upload for photos |
| **NFR-SEC-1** | Rate Limiting: 100 req/min global, 5 req/min on `/api/auth/*` |
| **NFR-SEC-2** | Security Headers & Strict CORS via `@fastify/helmet` and explicit origins |
| **NFR-SEC-3** | Multi-tenant Data Isolation: Strict `user_id` scoping on all queries and mutations |
| **NFR-OBS-1** | Structured Logging & Redaction: Pino logs with UUID request IDs; JWT/passwords redacted |
| **NFR-OBS-2** | Dual Health Probes: `/health/live` (process alive) and `/health/ready` (Postgres & Azure Blob checks) |
| **NFR-OBS-3** | Uniform Error Envelope: `{ "error": { "code": string, "message": string } }`, zero stack traces in production |
| **NFR-AI-1** | LLM Resilience: 15s request timeout, retries on 429/503, graceful degradation to deterministic analytics |
