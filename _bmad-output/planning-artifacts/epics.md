---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/research/technical-backend-resilience-2026-09-03/research.md"
---

# booking-service - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for booking-service (Daily Mind & Mood Journal), decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User Registration & Password Hashing (Argon2id/Bcrypt work factor >= 12, duplicate email rejection with HTTP 409)
FR2: User Authentication & JWT Issuance (Email/password verification, stateless signed JWT with expiry, uniform error responses)
FR3: Tenant Data Isolation Guard (Bearer token authentication, strict SQL tenant scoping WHERE user_id = :userId)
FR4: Create or Update Daily Entry (Upsert by Date, single entry per calendar date YYYY-MM-DD, UNIQUE(user_id, entry_date), regex and leap-year validation, semantic mood [bad, neutral, good, very_good], note max 50KB, max 10 tags)
FR5: View Entry by Date (Retrieve entry for YYYY-MM-DD, returns HTTP 404 with code ENTRY_NOT_FOUND if absent)
FR6: Paginated Entry List & History (Chronological listing, date range filters, pagination default limit=20, max 50)
FR7: Delete Entry (Permanently deletes database entry and triggers associated Azure Blob asset cleanup)
FR8: Direct-to-Storage Upload URL Generation & Client Compression (In-browser canvas resize/WebP conversion, SAS URL issuance, zero backend image buffering)
FR9: Secure Media Retrieval (Time-limited SAS URLs or authenticated proxy stream; no public blob exposure)
FR10: Mood Distribution & Streak Calculation (Journaling streak, total entries, 7/30/90-day rolling mood averages computed deterministically)
FR11: Activity & Mood Correlation Computation (Mathematical correlation between tagged activities and mood deltas computed deterministically)
FR12: Contextual Query Answering & Prompt Injection Hardening (Conversational Q&A grounded strictly in stored historical entries and deterministic metrics; journal data bounded in structural XML <user_journal_data> tags; 30-day context ceiling)
FR13: Asynchronous Periodic Reflection Review (Asynchronous job queue returning HTTP 202 with jobId, cached results by date range, preventing server socket starvation)
FR14: Graceful AI Degradation (External LLM timeout/429 fallback to deterministic analytics; journal CRUD is never blocked)
FR15: Local-First Client Snapshotting (IndexedDB local replica providing instant offline read/write and disaster protection)
FR16: Journal Snapshot Export & Disaster Re-seed (One-click JSON+images export; batch restore endpoint to re-seed cloud if database is wiped)
FR17: Account & Cascade Data Deletion (GDPR / Clean Erasure: complete atomic purge of user record, journal entries, and all Azure photo blobs)

### NonFunctional Requirements

NFR1: Database Connection Pool Guardrails (PostgreSQL pool max 20, connectionTimeoutMillis 5000ms, idleTimeoutMillis 10000ms, statement_timeout 3000ms)
NFR2: Graceful Teardown (On SIGTERM/SIGINT, stop accepting new requests, drain in-flight requests within 10s, execute Fastify onClose hooks to close DB pool and flush logs, exit code 0)
NFR3: Memory & Direct Storage Ingestion (1MB global JSON body limit; direct SAS upload bypassing server RAM)
NFR4: Transactional Database Operations (Multi-step mutations execute within managed database transactions rolling back on error)
NFR5: Zero Data Loss via Local-First Snapshot (Browser IndexedDB replica remains authoritative if cloud is wiped)
NFR6: Layered Rate Limiting (Global 100 req/min per IP, Auth routes /api/auth/* 5 req/min per IP with Retry-After header and standard error envelope)
NFR7: Security Headers & Strict CORS (Apply @fastify/helmet with nosniff, frameguard DENY, HSTS; CORS restricted to frontend origin)
NFR8: Zero Data Leakage in Errors (Uniform error envelope { "error": { "code": string, "message": string } }; no stack traces exposed in production)
NFR9: Strict Multi-Tenant Scoping (All database operations enforce tenant boundaries at the SQL layer WHERE user_id = :userId)
NFR10: Timing Attack & User Enumeration Defense (Constant-time password verification via timingSafeEqual and dummy hash comparison on nonexistent emails)
NFR11: Structured Logging & Secret Redaction (JSON logging via Pino with UUID request IDs; authorization header and passwords redacted)
NFR12: Dual Health Probes (/health/live liveness check for process responsiveness; /health/ready readiness probe checking PostgreSQL SELECT 1 and Azure Blob reachability)
NFR13: LLM Resilience & Timeouts (15s request timeout via AbortSignal.timeout(15000), up to 3 retries with exponential backoff and jitter on 429/503 errors, graceful fallback to deterministic analytics)
NFR14: Asynchronous Review Queue & Rate Protection (Dedicated rate limit on /api/ai/*: 10 calls / 10 min per user, max 3,000 token prompt context ceiling, and asynchronous queueing)
NFR15: API Latency Budget (Core Journal CRUD p95 < 150ms)
NFR16: Ponytail Code Minimalism & TDD (Native platform APIs and stdlib first, Red-Green TDD, diffs under 50 lines)
NFR17: Client-Side Media Compression (In-browser image downscaling reduces binary upload payloads by >90%)

### Additional Requirements

- Layered Modular Architecture: Fastify routes -> pure Domain Services -> Drizzle ORM Data Access -> Azure/LLM Adapters.
- Direct-to-Storage Ingestion: Scoped SAS tokens from Fastify backend; direct upload to Azure Blob Storage; client-side resizing in WebWorker.
- Local-First Client Architecture: React 19 + Vite 6 + Tailwind CSS 4 with IndexedDB storage layer and native HTML controls (`<input type="date">`).
- Disaster Recovery Re-seed: Batch import route (`POST /api/journal/restore`) allowing client local snapshot to re-populate a fresh or restored cloud database.
- Greenfield Initialization: Node.js 22 LTS, Fastify 5, TypeScript 5.7, Drizzle ORM 0.38 + Drizzle Kit 0.30 under `server/`.
- Idempotent Azure Provisioning: PowerShell/az CLI script `infra/setup-azure.ps1` for PostgreSQL Flexible Server, Azure Blob Storage, and Resource Group.
- Database Schema & Indexing: Explicit B-tree indexes on `user_id` and `entry_date`; transactional migration runner via `migrate(db)`.
- DevOps Governance & Fault Injection: BMad drills for deliberate defect injection, agent triage, and fast rollback.

### UX Design Requirements

None (No standalone UX specification document; design follows native browser controls, accessible semantics, and Tailwind CSS).

### FR Coverage Map

- FR1: Epic 1 - User Registration & Password Hashing
- FR2: Epic 1 - User Authentication & JWT Issuance
- FR3: Epic 1 - Tenant Data Isolation Guard
- FR4: Epic 2 - Create or Update Daily Entry (Upsert by Date)
- FR5: Epic 2 - View Entry by Date
- FR6: Epic 2 - Paginated Entry List & History
- FR7: Epic 2 - Delete Entry
- FR8: Epic 3 - Direct-to-Storage Upload URL Generation & Client Compression
- FR9: Epic 3 - Secure Media Retrieval (SAS Tokens)
- FR10: Epic 4 - Mood Distribution & Streak Calculation
- FR11: Epic 4 - Activity & Mood Correlation Computation
- FR12: Epic 5 - Contextual Query Answering & Prompt Injection Hardening
- FR13: Epic 5 - Asynchronous Periodic Reflection Review
- FR14: Epic 5 - Graceful AI Degradation
- FR15: Epic 2 - Local-First Client Snapshotting (IndexedDB)
- FR16: Epic 6 - Journal Snapshot Export & Disaster Re-seed
- FR17: Epic 1 - Account & Cascade Data Deletion (GDPR)

## Epic List

### Epic 1: User Authentication & Multi-Tenant Security
Establish the foundational Fastify server, database connection with Drizzle ORM, secure user authentication with JWT, constant-time password verification, route-level rate limiting, and account cascade deletion.
**FRs covered:** FR1, FR2, FR3, FR17

### Epic 2: Daily Journal Logging & Local-First Offline Resilience
Enable users to capture, read, update, and delete daily journal entries (text notes, mood rating 1-5, tags) for any calendar date with immediate local-first IndexedDB persistence, working seamlessly offline and syncing with cloud PostgreSQL.
**FRs covered:** FR4, FR5, FR6, FR7, FR15

### Epic 3: Direct-to-Storage Photo of the Day
Allow users to attach a daily photo to any journal entry with instant in-browser optimization (resizing, HEIC-to-WebP conversion via WebWorker) and direct-to-cloud upload via Azure Blob SAS URLs without server CPU or network bottlenecks.
**FRs covered:** FR8, FR9

### Epic 4: Deterministic Analytics & Habit-Mood Trends
Enable users to view their journaling streaks and analyze mathematical correlations between tagged lifestyle habits and emotional well-being over time using pure, 100% test-driven domain algorithms.
**FRs covered:** FR10, FR11

### Epic 5: Asynchronous AI Reflection Companion
Enable users to converse with an empathetic AI reflection companion grounded in historical journal entries and receive comprehensive periodic reviews via a decoupled, non-blocking asynchronous job queue.
**FRs covered:** FR12, FR13, FR14

### Epic 6: Disaster Recovery & Full Journal Portability
Provide users with one-click full journal snapshot export (JSON + images) for absolute personal data sovereignty and an atomic batch restore endpoint to re-seed an empty or restored cloud database from their local device snapshot.
**FRs covered:** FR16

## Epic 1: User Authentication & Multi-Tenant Security

Establish the foundational Fastify server, database connection with Drizzle ORM, secure user authentication with JWT, constant-time password verification, route-level rate limiting, and account cascade deletion.

### Story 1.1: Project Skeleton, Health Checks & Production Guardrails

As a system operator,
I want a lightweight, secure Fastify server with health checks and graceful teardown,
So that the service boots reliably, reports its status, and does not drop inflight requests during restarts.

**Acceptance Criteria:**

**Given** the Fastify server is running
**When** a client sends `GET /health/live`
**Then** the response status is 200 with `{ "status": "ok" }`
**And** the response headers include standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).

**Given** the PostgreSQL database connection pool is healthy
**When** a client sends `GET /health/ready`
**Then** the response status is 200 with `{ "status": "ready", "checks": { "database": true } }`.

**Given** the database connection is unreachable
**When** a client sends `GET /health/ready`
**Then** the response status is 503 with `{ "status": "unhealthy", "checks": { "database": false } }`.

**Given** active HTTP requests are being processed
**When** the Node.js process receives `SIGTERM` or `SIGINT`
**Then** the server stops accepting new connections, drains existing requests within a 10s window, runs `onClose` hooks to close the `pg.Pool`, and exits with code 0.

### Story 1.2: User Registration & Password Hashing

As a new user,
I want to register an account with my email and password,
So that I can have a private, secure journal workspace.

**Acceptance Criteria:**

**Given** a valid, unregistered email and a password of at least 8 characters
**When** a client sends `POST /api/auth/register` with `{ "email": "user@example.com", "password": "SecurePassword123" }`
**Then** the response status is 201 with `{ "userId": "<UUID>", "email": "user@example.com" }`
**And** a new row is inserted into `users` with `id`, `email`, a hashed password (Argon2id/Bcrypt), and `created_at`
**And** the plain text password is never stored or logged.

**Given** an existing user with email "user@example.com"
**When** a client sends `POST /api/auth/register` with the same email
**Then** the response status is 409 Conflict with `{ "error": { "code": "EMAIL_EXISTS", "message": "Email already registered" } }`
**And** no new database record is created.

**Given** invalid registration inputs (e.g. malformed email or password < 8 characters)
**When** a client sends `POST /api/auth/register`
**Then** the response status is 422 Unprocessable Entity with `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }`.

### Story 1.3: User Login, JWT Issuance & Anti-Enumeration Defense

As a registered user,
I want to log in with my email and password to receive a JWT session token,
So that I can securely access my private journal data.

**Acceptance Criteria:**

**Given** a registered user with valid credentials
**When** a client sends `POST /api/auth/login` with `{ "email": "user@example.com", "password": "SecurePassword123" }`
**Then** the response status is 200 with `{ "token": "<JWT>", "expiresIn": 86400 }`
**And** the JWT payload contains `userId` and `exp`.

**Given** an incorrect password or an email that does not exist in the database
**When** a client sends `POST /api/auth/login`
**Then** the response status is 401 Unauthorized with `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }`
**And** the verification execution time is indistinguishable between existing and non-existing users (dummy hash check using `crypto.timingSafeEqual` to prevent timing attacks and user enumeration).

**Given** a client IP exceeding 5 login requests within 1 minute
**When** a client sends another `POST /api/auth/login` request
**Then** the response status is 429 Too Many Requests with `{ "error": { "code": "RATE_LIMITED", "message": "Too many login attempts. Please retry later." } }`
**And** the response includes a `Retry-After` header.

### Story 1.4: Tenant Isolation Guard & Account Cascade Deletion

As an authenticated user,
I want my requests to strictly access only my data and be able to permanently delete my account,
So that my privacy is absolute and I retain complete data sovereignty.

**Acceptance Criteria:**

**Given** a valid signed JWT Bearer token in the `Authorization` header
**When** a client accesses any protected route (e.g. `GET /api/auth/me`)
**Then** the response status is 200 with `{ "userId": "<UUID>", "email": "user@example.com" }`
**And** the route handler receives the verified `userId` directly from `request.user`.

**Given** a missing, expired, or tampered JWT token
**When** a client sends a request to any protected route
**Then** the response status is 401 Unauthorized with `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.

**Given** an authenticated user
**When** a client sends `DELETE /api/auth/account`
**Then** the response status is 200 with `{ "status": "deleted" }`
**And** the user record in `users` and all associated database records are atomically removed in a single transaction.

## Epic 2: Daily Journal Logging & Local-First Offline Resilience

Enable users to capture, read, update, and delete daily journal entries (text notes, semantic mood rating [bad, neutral, good, very_good], tags) for any calendar date with immediate local-first IndexedDB persistence, working seamlessly offline and syncing with cloud PostgreSQL.

### Story 2.1: Daily Entry Schema, Semantic Mood & Upsert

As an authenticated user,
I want to create or update my journal entry for a given calendar date with notes, tags, and a semantic mood rating,
So that I can effortlessly record my daily experience without thinking in numbers.

**Acceptance Criteria:**

**Given** an authenticated user and a valid calendar date (`YYYY-MM-DD`)
**When** a client sends `PUT /api/journal/entries/2026-09-03` with:
  ```json
  {
    "notes": "Had a productive day pair programming with AI.",
    "mood": "good",
    "tags": ["coding", "walk"]
  }
  ```
**Then** the response status is 200 with the saved entry object containing `id`, `userId`, `entryDate`, `notes`, `mood`, `tags`, `createdAt`, `updatedAt`
**And** a row is inserted or updated in `journal_entries` enforcing `UNIQUE(user_id, entry_date)`.

**Given** an invalid date string (e.g. `2026-02-30` or `invalid-date`)
**When** a client sends `PUT /api/journal/entries/:date`
**Then** the response status is 422 Unprocessable Entity with `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }`.

**Given** a mood value outside `['bad', 'neutral', 'good', 'very_good']`
**When** a client sends `PUT /api/journal/entries/:date`
**Then** the response status is 422 Unprocessable Entity with `{ "error": { "code": "VALIDATION_ERROR", "message": "Mood must be one of: bad, neutral, good, very_good" } }`.

**Given** notes exceeding 50,000 characters or more than 10 tags
**When** a client sends `PUT /api/journal/entries/:date`
**Then** the response status is 422 Unprocessable Entity.

### Story 2.2: Retrieve Entry by Date & Chronological Paginated History

As an authenticated user,
I want to view a specific day's entry or browse my paginated journal history,
So that I can reflect on past days and navigate my timeline efficiently.

**Acceptance Criteria:**

**Given** an existing entry for date `2026-09-03` belonging to the authenticated user
**When** a client sends `GET /api/journal/entries/2026-09-03`
**Then** the response status is 200 with the entry details.

**Given** no entry exists for date `2026-09-03` for the authenticated user
**When** a client sends `GET /api/journal/entries/2026-09-03`
**Then** the response status is 404 with `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }`.

**Given** an authenticated user with multiple historical entries
**When** a client sends `GET /api/journal/entries?page=1&limit=20`
**Then** the response status is 200 with `{ "entries": [...], "pagination": { "page": 1, "limit": 20, "total": N, "hasMore": boolean } }`
**And** entries are ordered chronologically descending (`entry_date DESC`).

**Given** date filter parameters `startDate=2026-08-01` and `endDate=2026-08-31`
**When** a client sends `GET /api/journal/entries?startDate=2026-08-01&endDate=2026-08-31`
**Then** only entries within that inclusive range are returned, using the composite B-tree index.

### Story 2.3: Delete Journal Entry

As an authenticated user,
I want to permanently delete a specific journal entry,
So that I have full control over what remains in my personal history.

**Acceptance Criteria:**

**Given** an existing entry for date `2026-09-03` belonging to the authenticated user
**When** a client sends `DELETE /api/journal/entries/2026-09-03`
**Then** the response status is 200 with `{ "status": "deleted" }`
**And** the record is permanently removed from `journal_entries` in an atomic transaction.

**Given** a request to delete an entry belonging to another user or for a date with no entry
**When** a client sends `DELETE /api/journal/entries/2026-09-03`
**Then** the response status is 404 with `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` (preventing IDOR).

### Story 2.4: Local-First Browser Snapshot & Offline Persistence (IndexedDB)

As an authenticated user,
I want my journal entries to save instantly to my device's local database and sync in the background,
So that I can journal offline with 0ms delay and never lose typed text if the network drops.

**Acceptance Criteria:**

**Given** the web client running in a modern browser supporting IndexedDB
**When** the user edits and saves an entry
**Then** the entry is immediately written to a local IndexedDB object store (`journal_entries`) before or concurrently with the network request
**And** the UI immediately reflects the saved state with zero network latency.

**Given** the device is offline or the backend returns a network error / 503
**When** the user saves an entry
**Then** the entry remains safely stored in IndexedDB marked with `syncStatus: "pending"`
**And** the UI displays an offline badge indicating changes are stored locally.

**Given** pending local changes in IndexedDB
**When** the client reconnects to the network and re-authenticates
**Then** the client automatically syncs pending entries to `PUT /api/journal/entries/:date` and clears the pending status upon successful HTTP 200 response.

## Epic 3: Direct-to-Storage Photo of the Day

Allow users to attach a daily photo to any journal entry with instant in-browser optimization (resizing, HEIC-to-WebP conversion via WebWorker) and direct-to-cloud upload via Azure Blob SAS URLs without server CPU or network bottlenecks.

### Story 3.1: Azure Blob SAS Upload Token Issuance & Photo Metadata

As an authenticated user,
I want to request a secure, direct-upload URL for my daily photo,
So that I can upload my image straight to cloud storage without overloading the application server.

**Acceptance Criteria:**

**Given** an authenticated user and an existing journal entry for date `2026-09-03`
**When** a client sends `POST /api/journal/entries/2026-09-03/photo-upload-url`
**Then** the response status is 200 with `{ "uploadUrl": "<AZURE_SAS_URL>", "blobName": "<UUID>.webp", "expiresIn": 900 }`
**And** the SAS token grants strictly `write` permissions to the user's isolated storage path for 15 minutes.

**Given** an authenticated user
**When** the upload to Azure Blob Storage finishes and the client sends `POST /api/journal/entries/2026-09-03/photo-confirm` with `{ "blobName": "<UUID>.webp" }`
**Then** the response status is 200 with `{ "status": "confirmed", "photoBlobName": "<UUID>.webp" }`
**And** the `journal_entries` table row for date `2026-09-03` is updated with `photo_blob_name`.

**Given** an attempt to request an upload URL for an entry belonging to another user
**When** a client sends `POST /api/journal/entries/:date/photo-upload-url`
**Then** the response status is 404 Not Found (preventing IDOR).

### Story 3.2: In-Browser Image Compression & Web Worker (OffscreenCanvas)

As a mobile or desktop user,
I want my device to compress and convert camera photos to lightweight WebP in the background before uploading,
So that uploads are fast, data usage is minimized, and my browser interface never freezes.

**Acceptance Criteria:**

**Given** a user selects an image file (JPEG, PNG, or iOS HEIC/HEIF) up to 10MB
**When** the client processing pipeline executes
**Then** an in-browser Web Worker utilizes `OffscreenCanvas` to downscale the image to a maximum dimension of 2048px (preserving aspect ratio) and encodes it to WebP format with quality 0.8 (~400KB)
**And** the main browser thread remains completely responsive (60fps, no UI freeze).

**Given** the compressed WebP blob and an upload SAS URL
**When** the client sends a `PUT` request directly to the Azure Blob SAS URL with header `x-ms-blob-type: BlockBlob`
**Then** Azure Blob Storage receives the binary stream directly without traversing the Fastify backend server.

**Given** an uncompressed file exceeding 10MB or a non-image file type
**When** the user selects the file
**Then** client-side validation rejects the file immediately before running the Web Worker, presenting a clear error message.

### Story 3.3: Secure Photo Viewing & SAS Retrieval

As an authenticated user,
I want to view the photo attached to my journal entry via a secure, time-limited link,
So that my private pictures are never exposed publicly to the internet.

**Acceptance Criteria:**

**Given** an authenticated user and an entry with an attached photo
**When** a client sends `GET /api/journal/entries/2026-09-03/photo-view-url`
**Then** the response status is 200 with `{ "viewUrl": "<AZURE_READ_SAS_URL>", "expiresIn": 3600 }`
**And** the SAS token grants strictly `read` permissions for exactly 1 hour.

**Given** a journal entry that has no attached photo
**When** a client sends `GET /api/journal/entries/:date/photo-view-url`
**Then** the response status is 404 with `{ "error": { "code": "PHOTO_NOT_FOUND", "message": "No photo attached to this entry" } }`.

**Given** an attempt to request a photo URL for another user's entry
**When** a client sends `GET /api/journal/entries/:date/photo-view-url`
**Then** the response status is 404 Not Found.

## Epic 4: Deterministic Analytics & Habit-Mood Trends

Enable users to view their journaling streaks and analyze mathematical correlations between tagged lifestyle habits and emotional well-being over time using pure, 100% test-driven domain algorithms.

### Story 4.1: Journaling Streak & Mood Distribution Engine (Pure Domain Logic TDD)

As an authenticated user,
I want to see my current consecutive journaling streak and semantic mood breakdown,
So that I can stay motivated to journal daily and visualize my emotional distribution.

**Acceptance Criteria:**

**Given** a list of entry dates where the most recent entry is today or yesterday
**When** the streak calculation function executes
**Then** it returns the exact consecutive number of days as `currentStreak` and the historical maximum as `longestStreak`
**And** skips or breaks the streak if more than 1 calendar day is missed between consecutive entries.

**Given** entries spanning rolling windows of 7, 30, and 90 days
**When** the mood distribution function executes
**Then** it returns the exact count and percentage for each semantic mood: `bad`, `neutral`, `good`, `very_good`
**And** total percentage across all categories sums to 100% (with zero floating-point rounding errors).

**Given** an empty list of entries (new user)
**When** the calculation function executes
**Then** it returns `{ "currentStreak": 0, "longestStreak": 0, "totalEntries": 0, "distribution": { "bad": 0, "neutral": 0, "good": 0, "very_good": 0 } }` without throwing errors.

### Story 4.2: Habit-Mood Correlation Calculator (Pure Domain Logic TDD)

As an authenticated user,
I want to discover which tagged activities correlate with my positive moods,
So that I have evidence-backed insights into what lifestyle habits elevate my well-being.

**Acceptance Criteria:**

**Given** a collection of journal entries with tags (e.g. `walk`, `reading`, `exercise`) and semantic moods
**When** the correlation algorithm executes
**Then** for each unique tag occurring at least 3 times, it calculates:
  1. `tagFrequency`: number of days tagged.
  2. `positiveRateWithTag`: percentage of entries with this tag that have mood `good` or `very_good`.
  3. `baselinePositiveRate`: percentage of entries without this tag that have mood `good` or `very_good`.
  4. `delta`: difference (`positiveRateWithTag - baselinePositiveRate`).

**Given** a tag where mood on tagged days is 80% positive compared to a 50% baseline
**When** the correlation algorithm executes
**Then** the calculated delta is `+30%` and marked with `impact: "positive"`.

**Given** fewer than 3 occurrences of a tag
**When** the algorithm runs
**Then** the tag is excluded from correlation reporting to avoid statistical noise from single-instance anecdotes.

### Story 4.3: Analytics API Endpoint with Indexed Querying

As an authenticated user,
I want to fetch my computed streak, mood distribution, and habit correlations via a fast API endpoint,
So that my dashboard loads instantly without lag.

**Acceptance Criteria:**

**Given** an authenticated user with journal history
**When** a client sends `GET /api/journal/analytics/trends?window=30`
**Then** the response status is 200 with structured JSON containing `streak`, `distribution`, and `correlations`
**And** response latency is p95 < 150ms.

**Given** the `window` parameter is omitted
**When** a client sends `GET /api/journal/analytics/trends`
**Then** the default window of 30 days is applied.

**Given** an invalid window parameter (e.g. `window=999` or `window=-5`)
**When** a client sends `GET /api/journal/analytics/trends?window=999`
**Then** the response status is 422 Unprocessable Entity with `{ "error": { "code": "VALIDATION_ERROR", "message": "Window must be 7, 30, or 90" } }`.

## Epic 5: Asynchronous AI Reflection Companion

Enable users to converse with an empathetic AI reflection companion grounded in historical journal entries and receive comprehensive periodic reviews via a decoupled, non-blocking asynchronous job queue.

### Story 5.1: LLM Client Adapter with AbortSignal Timeout & Prompt Injection Defense

As a system,
I want a resilient LLM client adapter that isolates user text inside structured data tags and enforces strict request timeouts,
So that conversational queries are safe from prompt injection attacks and never hang indefinitely.

**Acceptance Criteria:**

**Given** a user reflection prompt and historical journal entries
**When** the adapter formats the LLM payload
**Then** historical entries are enclosed inside `<user_journal_data>` XML tags
**And** system instructions explicitly mandate that content inside `<user_journal_data>` is untrusted data and must never override system directives.

**Given** an outgoing call to the LLM API (OpenAI / Azure OpenAI)
**When** the request exceeds 15 seconds
**Then** the request is aborted via `AbortSignal.timeout(15000)` and throws a specific timeout error.

**Given** the external LLM API responds with HTTP 429 (rate limit) or HTTP 503 (service unavailable)
**When** the adapter executes
**Then** it automatically retries up to 3 times with exponential backoff and randomized jitter before rejecting.

### Story 5.2: Asynchronous Reflection Review Job Queue & Throttling

As an authenticated user,
I want to request an in-depth periodic reflection review without waiting on a hanging HTTP connection,
So that my dashboard remains responsive and the server does not exhaust its connection resources.

**Acceptance Criteria:**

**Given** an authenticated user requesting a 30-day review
**When** a client sends `POST /api/ai/reviews/generate` with `{ "windowDays": 30 }`
**Then** the response status is 202 Accepted with `{ "jobId": "<UUID>", "status": "pending" }`
**And** a background worker picks up the job, fetches computed analytics, and requests LLM synthesis.

**Given** an in-progress review job
**When** a client sends `GET /api/ai/reviews/jobs/:jobId`
**Then** the response status is 200 with `{ "jobId": "<UUID>", "status": "pending" }`.

**Given** a completed review job
**When** a client sends `GET /api/ai/reviews/jobs/:jobId`
**Then** the response status is 200 with `{ "jobId": "<UUID>", "status": "completed", "review": { "summary": "...", "highlights": [...], "suggestions": "..." } }`.

**Given** a user sending more than 10 review requests within 10 minutes
**When** a client sends another `POST /api/ai/reviews/generate`
**Then** the response status is 429 Too Many Requests with `{ "error": { "code": "AI_RATE_LIMITED", "message": "Review generation rate limit reached. Please wait." } }`.

### Story 5.3: Graceful AI Degradation & Conversational Query Endpoint

As an authenticated user,
I want to ask conversational reflection questions about my journal and receive fallback statistics if the AI service fails,
So that I never encounter broken error screens or lose access to my personal trends.

**Acceptance Criteria:**

**Given** an authenticated user asking a reflection question (e.g. "How has my mood been on days I walked?")
**When** a client sends `POST /api/ai/chat` with `{ "question": "How has my mood been on days I walked?" }` and the LLM service is healthy
**Then** the response status is 200 with `{ "answer": "<AI_SYNTHESIZED_RESPONSE>", "citedDates": ["2026-08-12", "2026-08-21"], "fallback": false }`.

**Given** the external LLM service is offline or timeout occurs
**When** a client sends `POST /api/ai/chat`
**Then** the response status is 200 with `{ "answer": "AI narrative synthesis is temporarily unavailable. Here are your deterministic metrics for the selected period:", "metrics": { "streak": 14, "correlations": [...] }, "fallback": true }`
**And** core journal CRUD endpoints (`PUT`, `GET`, `DELETE`) remain 100% operational with zero degradation.

## Epic 6: Disaster Recovery & Full Journal Portability

Provide users with one-click full journal snapshot export (JSON + images) for absolute personal data sovereignty and an atomic batch restore endpoint to re-seed an empty or restored cloud database from their local device snapshot.

### Story 6.1: One-Click Journal Snapshot Export (Data Portability)

As an authenticated user,
I want to export a complete snapshot of all my journal entries as a downloadable JSON file,
So that I have a personal offline backup independent of any cloud provider.

**Acceptance Criteria:**

**Given** an authenticated user with journal history in local IndexedDB
**When** the user clicks "Export Backup"
**Then** the client reads all records from IndexedDB and generates a single structured JSON file named `journal-backup-YYYY-MM-DD.json`
**And** initiates a direct browser file download without making a server request.

**Given** an exported snapshot JSON file
**When** inspected
**Then** it contains the complete schema: `version`, `exportedAt`, `userEmail`, and an array of `entries` with dates, notes, semantic moods, tags, and photo identifiers.

### Story 6.2: Disaster Recovery Batch Re-seed Endpoint (TDD)

As an authenticated user whose cloud database was corrupted or emptied,
I want to upload my local journal snapshot to restore all my past entries in a single operation,
So that my cloud history is fully recovered without manual re-typing.

**Acceptance Criteria:**

**Given** an authenticated user and an empty or partially populated cloud database
**When** a client sends `POST /api/journal/restore` with a valid array of entry objects from a backup
**Then** the backend executes an atomic batch upsert inside `db.transaction()`
**And** all entries are safely written to `journal_entries` with status 200 `{ "restoredCount": N }`.

**Given** an invalid backup payload (e.g. malformed date format or invalid mood string)
**When** a client sends `POST /api/journal/restore`
**Then** the response status is 422 Unprocessable Entity
**And** the entire transaction rolls back, leaving the database completely uncorrupted (zero partial writes).
