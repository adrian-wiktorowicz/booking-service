---
title: 'PRD: Daily Mind & Mood Journal'
status: approved
created: '2026-09-03'
updated: '2026-09-03'
---

# PRD: Daily Mind & Mood Journal

## 0. Document Purpose

This Product Requirements Document (PRD) defines the functional requirements (FRs), non-functional requirements (NFRs), and operational invariants for the **Daily Mind & Mood Journal**. It derives from the [Product Brief](file:///G:/testowanie/booking-service/_bmad-output/planning-artifacts/briefs/brief-booking-service-2026-09-02/brief.md), [Addendum](file:///G:/testowanie/booking-service/_bmad-output/planning-artifacts/briefs/brief-booking-service-2026-09-02/addendum.md), [Architecture Spine](file:///G:/testowanie/booking-service/_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md), [Technical Research on Backend Resilience](file:///G:/testowanie/booking-service/_bmad-output/planning-artifacts/research/technical-backend-resilience-2026-09-03/research.md), and the high-scale stress analysis addressing 10k concurrent AI reviews, 10k image uploads, and disaster-recovery / zero-data-loss guarantees.

---

## 1. Vision

Modern journaling tools are often passive, write-only digital filing cabinets. Users spend time recording daily notes, emotional states, and milestones, but rarely revisit them to glean actionable wisdom or recognize behavioral patterns. 

**Daily Mind & Mood Journal** transforms daily journaling into an active, reflective dialogue. By combining an ultra-responsive daily log engine with an intelligent, grounded AI reflection companion, users can log thoughts, mood ratings, activities, and a single "Photo of the Day", while receiving empathetic, mathematically grounded insights into what elevates their well-being.

Simultaneously, this system acts as a high-discipline **engineering playground** built under the **BMad Method**. It enforces strict backend reliability standards, red-green test-driven development (TDD), zero speculative abstractions (Ponytail minimalism), and intentional operational resilience:
- **Zero Data Loss Guarantee:** Local-first client snapshotting in browser IndexedDB ensures that even in the catastrophic event of cloud database corruption, user data is preserved on their personal device.
- **Direct-to-Storage Ingestion:** Eliminates backend CPU and bandwidth saturation by issuing signed Azure Blob SAS URLs with client-side image downscaling.
- **Asynchronous AI Queue:** Decouples multi-entry AI reviews from synchronous HTTP connections, preventing connection exhaustion and LLM provider rate-limit storms.

---

## 2. Target User

### 2.1 Jobs To Be Done (JTBD)
- **Functional:** Quickly record what happened today (activities, plans, mood, photo) in under 2 minutes with zero friction, working seamlessly both offline and online.
- **Analytical:** Understand the correlation between daily habits (e.g., outdoor walks, nutrition) and emotional well-being over weeks and months.
- **Reflective:** Converse with an AI companion that remembers past entries, quotes historical context accurately, and helps work through challenges.
- **Data Sovereignty:** Own personal memories locally with guaranteed zero data loss via device-level snapshots and exportable backups.
- **Engineering / Leadership:** Practice rigorous full-stack AI pair programming, CI/CD discipline, automated testing, and chaos/rollback drills without risking enterprise production assets.

### 2.2 Non-Users (v1)
- Social media influencers seeking public sharing, likes, or multi-user collaborative journals.
- Users seeking a high-throughput multi-image photo album or gallery app (strictly 1 image per day in v1).
- Teams needing enterprise team wikis or project management boards.

### 2.3 Key User Journeys

#### UJ-1: Daily Check-in with Direct Photo Upload & Local Snapshot
- **Persona + context:** Adria checking in on a smartphone or laptop after an evening walk.
- **Entry state:** Authenticated on web app (works even in spotty network / offline mode).
- **Path:**
  1. Opens dashboard; today's date (`YYYY-MM-DD`) is automatically selected.
  2. Rates today's mood as 4/5 and selects tags: `[peaceful, energized]`.
  3. Writes notes and reflections in markdown. Record is **instantly saved to local IndexedDB**.
  4. Attaches a photo taken on an iPhone (HEIC format, 10MB).
  5. The browser converts and compresses the image locally in an OffscreenCanvas Web Worker to a 2048px WebP (~400KB).
  6. Frontend requests a short-lived SAS upload URL from `/api/journal/entries/:date/photo-upload-url`.
  7. Browser uploads the image directly to Azure Blob Storage; backend registers metadata.
- **Climax:** Entry is safely stored both in the local browser database and the cloud database in <300ms.
- **Resolution:** Adria closes the browser knowing memories are safe offline and synced online.

#### UJ-2: Requesting an Asynchronous AI Reflection Review
- **Persona + context:** Adria requesting a comprehensive monthly review during a high-traffic period.
- **Entry state:** Authenticated on the Insights tab.
- **Path:**
  1. Clicks: *"Generate 30-Day Reflection Review"*.
  2. Backend validates request, checks if a cached review exists for this date range, and enqueues a background job.
  3. Backend immediately responds with HTTP 202 Accepted and a `jobId`.
  4. Frontend polls or receives an event while displaying a clean progress spinner.
  5. The background worker throttles LLM calls according to token quotas, compiles precomputed correlation facts, and formats the empathetic synthesis.
- **Climax:** Review arrives within seconds without hanging server sockets or starving database pools.

#### UJ-3: Disaster Recovery via Local-First Snapshot
- **Persona + context:** Cloud database experiences a catastrophic wipe or migration corruption.
- **Entry state:** Authenticated user with empty cloud database.
- **Path:**
  1. User opens the application; all historical entries are instantly loaded from browser IndexedDB.
  2. The application detects the cloud database is empty / desynchronized.
  3. System prompts: *"Cloud storage desynchronized. Restore cloud from your local device snapshot?"*
  4. User clicks "Restore", and the client syncs all local entries back to the backend.
- **Climax:** Zero user data is lost despite total backend data loss.

---

## 3. Glossary

- **User**: The authenticated individual owning a private journal repository.
- **Journal Entry**: A single record associated with a calendar date (`YYYY-MM-DD`) containing notes, mood rating, emotional tags, and an optional photo attachment.
- **Calendar Date**: Date formatted strictly as ISO-8601 `YYYY-MM-DD` in user calendar context.
- **Local-First Snapshot**: Persistent browser-side replica stored in **IndexedDB** that serves as an immediate read/write cache and disaster-recovery backup.
- **Direct-to-Storage Upload**: Pattern where the client uploads binaries directly to Azure Blob Storage using a temporary Shared Access Signature (SAS) URL, bypassing server CPU/network.
- **Client-Side Image Preprocessing**: In-browser downscaling and conversion of high-res camera photos (including iOS HEIC) to standard WebP before transmission.
- **Asynchronous AI Job**: Decoupled background task for multi-entry reflection reviews returning HTTP 202 Accepted to prevent connection pool exhaustion.
- **Mood Rating**: Integer scale from 1 (lowest / distressed) to 5 (highest / ecstatic).
- **Photo of the Day**: A single compressed image asset associated with a journal entry, stored in Azure Blob Storage.
- **Deterministic Analytics**: Pure TypeScript mathematical algorithms calculating aggregations, streaks, and correlations with zero external network or LLM dependencies.

---

## 4. Features & Functional Requirements

### 4.1 Authentication & Multi-Tenant Isolation
**Description:** Secure email and password authentication providing stateless JSON Web Tokens (JWT). All subsequent domain operations strictly enforce multi-tenant scoping so users can only ever access their own records. Realizes UJ-1, UJ-2.

#### FR-1: User Registration & Password Hashing
Users can register with a unique email address and a strong password (minimum 8 characters). Passwords must be hashed using Argon2id or Bcrypt (work factor >= 12).
- **Consequences:** Duplicate email registration returns HTTP 409 Conflict with standard error envelope. Weak passwords return HTTP 422 Unprocessable Entity.

#### FR-2: User Authentication & JWT Issuance
Users can authenticate with email and password. Upon successful verification, the server issues a signed, stateless JWT containing the `userId` with a configured expiration time.
- **Consequences:** Invalid credentials return HTTP 401 Unauthorized with uniform error message (`"Invalid email or password"`), preventing user enumeration. Failed attempts are subject to strict route-level rate limiting.

#### FR-3: Tenant Data Isolation Guard
All protected routes require a valid Bearer token in the `Authorization` header. Handlers must extract the authenticated `userId` exclusively from the verified token context.
- **Consequences:** Any attempt to read, edit, or delete an entry belonging to another user returns HTTP 404 Not Found (or HTTP 403 Forbidden) without revealing resource existence (preventing IDOR/BOLA).

---

### 4.2 Daily Journal CRUD, Calendar Navigation & Local Snapshot
**Description:** Core log engine allowing users to capture rich markdown text, planned tasks, completed tasks, and mood ratings for any calendar date, backed by local-first browser storage. Realizes UJ-1, UJ-3.

#### FR-4: Create or Update Daily Entry (Upsert by Date & Strict Date Validation)
Users can create or update a journal entry for a specified `YYYY-MM-DD`. Exactly one journal entry can exist per user per date (`UNIQUE(user_id, entry_date)`).
- **Consequences:** The system strictly validates `entry_date` against regex `^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$` and verifies calendar validity (e.g. leap years). Note field capped at 50,000 characters; tags capped at 10 items (max 30 chars each). Saving updates local IndexedDB instantly and syncs to PostgreSQL.

#### FR-5: View Entry by Date
Users can retrieve the journal entry for a given calendar date (`YYYY-MM-DD`).
- **Consequences:** Retrieves from local cache first, synchronizing with backend. If no entry exists, returns HTTP 404 with specific code `ENTRY_NOT_FOUND`.

#### FR-6: Paginated Entry List & History
Users can retrieve a chronological list of historical entries with optional date range filters (`startDate`, `endDate`).
- **Consequences:** Paginated with default `limit=20` and hard maximum `limit=50`. Returns pagination metadata (`total`, `page`, `hasMore`).

#### FR-7: Delete Entry
Users can permanently delete an existing journal entry for a given date.
- **Consequences:** Deleting an entry removes its record from IndexedDB, deletes the PostgreSQL row, and triggers deletion of any attached cloud storage blob.

---

### 4.3 Photo of the Day (Direct-to-Storage & Client Optimization)
**Description:** Allows users to attach a single photograph per daily entry with client-side preprocessing and direct Azure Blob SAS upload. Realizes UJ-1.

#### FR-8: Direct-to-Storage Upload URL Generation & Client Compression
Users can attach a photo (JPEG, PNG, WebP, HEIC/HEIF) up to 10MB from their device camera or gallery.
- **Consequences:** 
  1. The client-side application resizes the image to a maximum dimension of 2048px and converts it to WebP (~400KB) in an OffscreenCanvas/WebWorker before upload, eliminating server CPU load and HEIC compatibility issues.
  2. The client requests a short-lived (15-minute) upload SAS URL from `/api/journal/entries/:date/photo-upload-url`.
  3. The client uploads the binary directly to Azure Blob Storage.
  4. Backend registers the photo URL in the database only upon confirmation of successful upload.

#### FR-9: Secure Media Retrieval
Users can view the Photo of the Day associated with their entry.
- **Consequences:** The server generates a time-limited Shared Access Signature (SAS) URL (1-hour validity) or serves an authenticated stream; no public blob exposure.

---

### 4.4 Deterministic Analytics & Trends Engine
**Description:** Pure TypeScript analytical calculations running on historical entries to detect correlations and streaks. Realizes UJ-2, UJ-3.

#### FR-10: Mood Distribution & Streak Calculation
The system calculates the user's current journaling streak (consecutive days with entries), total entry count, and average mood rating over rolling windows (7-day, 30-day, 90-day).
- **Consequences:** Logic executes deterministically with 100% test coverage and zero floating-point anomalies, querying with indexed limits.

#### FR-11: Activity & Mood Correlation Computation
The system analyzes mood ratings grouped by tagged activities (e.g., comparing days tagged `walk` vs days without `walk`).
- **Consequences:** Output is structured JSON containing sample count, average mood delta, and statistical significance indicator.

---

### 4.5 AI Reflection Companion & Asynchronous Reviews
**Description:** Contextual chat interface and asynchronous review generator that uses deterministic analytics to provide empathetic reflections and answer user questions without server socket starvation. Realizes UJ-2.

#### FR-12: Contextual Query Answering & Prompt Injection Hardening
Users can ask conversational questions about their past journal entries. The backend queries relevant entries (bounded to a maximum 30-day window or 20 entries), formats them inside structural data blocks `<user_journal_data>...</user_journal_data>`, and instructs the LLM that content inside the tag is untrusted data and must never be executed as instructions.
- **Consequences:** Strictly guards against prompt injection and bounds context cost.

#### FR-13: Asynchronous Periodic Reflection Review
Users can request an automated weekly or monthly reflective review.
- **Consequences:** To handle high concurrency without starving connections, the backend generates an asynchronous job returning HTTP 202 Accepted with a `jobId`. A background worker fetches precomputed facts, queries the LLM with token rate-limiting, and stores the resulting review. Subsequent requests for the same date range return the cached review.

#### FR-14: Graceful AI Degradation
If the external LLM service encounters rate limits (429), timeouts (>15s), or server errors (500/503), the system falls back to providing the deterministic analytics directly to the user with a non-intrusive status notice.
- **Consequences:** Journal CRUD operations are never degraded or blocked by LLM provider issues.

---

### 4.6 Disaster Recovery & Data Sovereignty
**Description:** Features guaranteeing that user memories are never lost, even during total cloud infrastructure failure. Realizes UJ-3.

#### FR-15: Local-First Client Snapshotting (IndexedDB)
The frontend automatically persists every journal entry in browser **IndexedDB**.
- **Consequences:** The user can read and write entries completely offline. When network connectivity is re-established, the client synchronizes local changes with the backend.

#### FR-16: Journal Snapshot Export & Disaster Re-seed
Users can trigger a one-click "Export Full Journal Snapshot" to download an archive (JSON + photos) to their local machine.
- **Consequences:** If the cloud database is lost or corrupted, the user can upload their local snapshot to a dedicated restore endpoint (`POST /api/journal/restore`) to completely re-seed their cloud journal.

#### FR-17: Account & Cascade Data Deletion (GDPR / Clean Erasure)
Users can permanently delete their account.
- **Consequences:** Executes an atomic cascade deletion that purges the user database record, all associated journal entries, and issues deletion commands for all user photo blobs stored in Azure Blob Storage.

---

## 5. Cross-Cutting Non-Functional Requirements (NFRs)

### 5.1 Reliability & Resource Protection (NFR-REL)
- **NFR-REL-1 (Database Connection Pool Guardrails):** PostgreSQL connection pool must enforce `max = 20`, `connectionTimeoutMillis = 5000ms`, `idleTimeoutMillis = 10000ms`, and `statement_timeout = 3000ms`.
- **NFR-REL-2 (Graceful Shutdown & Teardown):** On `SIGTERM` or `SIGINT`, the server must immediately stop accepting new connections, allow up to 10 seconds to drain in-flight requests, run Fastify `onClose` hooks to close the database pool and flush log buffers, and exit with code 0.
- **NFR-REL-3 (Memory & Direct Storage Ingestion):** Global JSON body limit capped at 1MB (`bodyLimit: 1048576`). Binary photo uploads bypass server memory via direct client-to-Azure Blob SAS URLs.
- **NFR-REL-4 (Transactional Database Operations):** All multi-step database mutations must execute within managed database transactions that roll back on failure.
- **NFR-REL-5 (Zero Data Loss via Local-First Snapshot):** IndexedDB local persistence ensures no data loss occurs if backend database is offline or wiped; local snapshot remains authoritative for un-synced entries.

### 5.2 Security, Headers & Abuse Prevention (NFR-SEC)
- **NFR-SEC-1 (Layered Rate Limiting):**
  - Global tier: 100 requests / minute per client IP.
  - Authentication tier (`/api/auth/*`): 5 requests / minute per client IP. Rate-limited requests return HTTP 429 with `Retry-After` header and structured error envelope.
- **NFR-SEC-2 (Security Headers & Strict CORS):** Use `@fastify/helmet` to set secure default headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, disabled `X-Powered-By`). CORS must restrict allowed origins to configured frontend URLs (no wildcard in production).
- **NFR-SEC-3 (Zero Data Leakage in Errors):** Production error responses must never expose stack traces, database schema details, or system file paths. Standard error envelope: `{ "error": { "code": string, "message": string } }`.
- **NFR-SEC-4 (Strict Multi-Tenant Scoping):** Every data access query and mutation must enforce `WHERE user_id = :authenticatedUserId` at the SQL layer.
- **NFR-SEC-5 (Timing Attack & User Enumeration Defense):** Password verification must execute constant-time checks (`timingSafeEqual`) and execute a dummy hash comparison when an email is not found, returning uniform authentication error responses.

### 5.3 Observability & Diagnostics (NFR-OBS)
- **NFR-OBS-1 (Structured Pino Logging & Redaction):** All logs must output JSON via Pino with standard fields: `level`, `time`, `reqId`, `msg`. The server must automatically generate UUID v4 request IDs (`x-request-id`). Sensitive headers (`authorization`, `cookie`) and payload fields (`password`) must be masked via Pino redaction.
- **NFR-OBS-2 (Dual Health Probes):**
  - `/health/live`: Fast liveness check returning HTTP 200 `{ "status": "ok" }` to prove process event loop responsiveness.
  - `/health/ready`: Readiness probe verifying PostgreSQL pool connectivity (`SELECT 1`) and Azure Blob Storage client reachability. Returns HTTP 503 if any critical dependency is offline.

### 5.4 External Service Resilience & AI Controls (NFR-AI)
- **NFR-AI-1 (LLM Request Timeout & Retries):** All external AI requests must enforce a strict 15-second timeout via `AbortSignal.timeout(15000)`. Transient failures (429, 503) must retry up to 3 times with exponential backoff and randomized jitter before failing gracefully.
- **NFR-AI-2 (Asynchronous Review Queue & Rate Protection):** Dedicated rate limit on `/api/ai/*` (10 calls / 10 min per user), 3,000 token context ceiling, and asynchronous queueing for multi-entry reviews to protect against thundering herd scenarios.

### 5.5 Performance & Code Minimalism (NFR-PERF)
- **NFR-PERF-1 (API Latency Budget):** Core Journal CRUD endpoints must respond with p95 < 150ms under normal load.
- **NFR-PERF-2 (Ponytail Code Minimalism):** Native platform APIs and stdlib features must be chosen over third-party npm packages wherever feasible. All features must be authored using Red-Green TDD with git diffs kept under 50 lines.
- **NFR-PERF-3 (Client-Side Media Compression):** In-browser image downscaling reduces binary upload payloads by >90% before transmission, preserving mobile data and backend network bandwidth.

---

## 6. Non-Goals (Explicit)

- **No Multi-User Public Collaboration:** The journal is strictly private; no public feeds, sharing links, or social mechanics.
- **No Heavy Vector Database / Full RAG:** v1 uses deterministic SQL queries and filtered prompt composition.
- **No Multi-Cloud Infrastructure Complexity:** No secondary cloud database replication (e.g. AWS/GCP); disaster recovery is achieved via local-first client snapshotting and manual export.
- **No Heavy Frontend Component Frameworks:** Frontend utilizes clean React 19 + Tailwind with native browser components (`<input type="date">`).

---

## 7. MVP Scope Matrix

| Capability / Invariant | In Scope (MVP) | Deferred (v2) |
| --- | --- | --- |
| Email / Password Auth & JWT | ✅ Yes | Social SSO (Google/Apple) |
| Journal Entry CRUD (text, mood, tags) | ✅ Yes | Multi-entry per day |
| Local-First Snapshot (IndexedDB) | ✅ Yes | Multi-device P2P sync |
| Direct-to-Storage Photo Upload (SAS URL) | ✅ Yes | Video / Audio attachments |
| Client-Side Image Resizing & HEIC handling | ✅ Yes | Serverless background transcoding |
| Deterministic Analytics (streaks, correlations) | ✅ Yes | Predictive ML modeling |
| Asynchronous AI Reviews (Job Queue) | ✅ Yes | Real-time WebSocket streaming |
| Journal Snapshot Export / Re-seed | ✅ Yes | Automated daily cloud backup to S3 |
| Account & Cascade Erasure (GDPR) | ✅ Yes | Automated compliance reporting |

---

## 8. Success Metrics & Counter-Metrics

### Primary Metrics
- **SM-1 (CRUD Speed & Reliability):** 99.9% of journal save operations succeed with <200ms latency.
- **SM-2 (Zero Inflight Data Loss During Shutdown):** 100% of inflight write requests complete successfully when the server receives `SIGTERM`.
- **SM-3 (Zero Data Loss on Cloud Wipe):** 100% of journal entries can be recovered from the client's IndexedDB snapshot if the cloud database is lost.
- **SM-4 (Direct Upload Scalability):** Server CPU and memory remain flat (<10% increase) during 10k concurrent image uploads due to client-side compression and direct SAS URLs.
- **SM-5 (AI Concurrency Resilience):** 10k concurrent review requests return HTTP 202 without exhausting Fastify connections or starving the database pool.

### Counter-Metrics (Do Not Over-Optimize)
- **SM-C1 (Bundle & Abstraction Bloat):** Do not introduce Redis or external message brokers for MVP; Fastify in-memory async queue and PostgreSQL locking are sufficient for single-developer playground.
