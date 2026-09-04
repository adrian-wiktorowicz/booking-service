---
title: 'PRD: Daily Mind & Mood Journal'
status: approved
created: '2026-09-03'
updated: '2026-09-03'
source: '_bmad-output/planning-artifacts/prds/prd-booking-service-2026-09-03/prd.md'
---

# PRD: Daily Mind & Mood Journal

The canonical PRD is maintained in the run folder:
👉 [_bmad-output/planning-artifacts/prds/prd-booking-service-2026-09-03/prd.md](file:///G:/testowanie/booking-service/_bmad-output/planning-artifacts/prds/prd-booking-service-2026-09-03/prd.md)

---

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

## 2. Key Features & Requirements Summary

### 2.1 Functional Requirements (FR-1 through FR-17)
- **FR-1:** User Registration & Password Hashing (Argon2id/Bcrypt work factor >= 12, duplicate email rejection).
- **FR-2:** User Authentication & JWT Issuance (Stateless signed JWT with expiry, uniform auth errors).
- **FR-3:** Tenant Data Isolation Guard (Strict SQL tenant scoping `WHERE user_id = :userId`).
- **FR-4:** Create or Update Daily Entry (Upsert by Date: `UNIQUE(user_id, entry_date)`, regex and leap-year validation, notes max 50KB, max 10 tags).
- **FR-5:** View Entry by Date (Retrieve entry for `YYYY-MM-DD`, returns 404 with clean code `ENTRY_NOT_FOUND` when empty).
- **FR-6:** Paginated Entry List & History (Chronological listing, date range filters, pagination default `limit=20`, max `50`).
- **FR-7:** Delete Entry (Permanently deletes database entry and triggers associated Azure Blob asset cleanup).
- **FR-8:** Direct-to-Storage Upload URL Generation & Client Compression (In-browser canvas resize/WebP conversion, SAS URL issuance, zero backend image buffering).
- **FR-9:** Secure Media Retrieval (Time-limited SAS URLs or authenticated proxy; no public blob exposure).
- **FR-10:** Mood Distribution & Streak Calculation (Journaling streak, total entries, rolling averages computed deterministically).
- **FR-11:** Activity & Mood Correlation Computation (Deterministic statistical correlation between activities and mood deltas).
- **FR-12:** Contextual Query Answering & Prompt Injection Hardening (Grounded Q&A inside `<user_journal_data>` structural tags; 30-day context ceiling).
- **FR-13:** Asynchronous Periodic Reflection Review (Asynchronous job queue returning HTTP 202 with `jobId`, cached results by date range).
- **FR-14:** Graceful AI Degradation (External LLM timeout/429 fallback to deterministic analytics; journal CRUD is never blocked).
- **FR-15:** Local-First Client Snapshotting (IndexedDB local replica providing instant offline read/write and disaster protection).
- **FR-16:** Journal Snapshot Export & Disaster Re-seed (One-click JSON+images export; batch restore endpoint to re-seed cloud if database is wiped).
- **FR-17:** Account & Cascade Data Deletion (GDPR / Clean Erasure: complete atomic purge of user record, journal entries, and all Azure photo blobs).

### 2.2 Non-Functional Requirements (NFR-1 through NFR-17)
- **NFR-1 (NFR-REL-1):** Database Connection Pool Guardrails (`max: 20`, `statement_timeout: 3000ms`, `connectionTimeoutMillis: 5000ms`).
- **NFR-2 (NFR-REL-2):** Graceful Teardown (`SIGTERM`/`SIGINT` draining inflight requests within 10s before closing DB pool).
- **NFR-3 (NFR-REL-3):** Memory & Direct Storage Ingestion (1MB JSON body limit; direct SAS upload bypassing server RAM).
- **NFR-4 (NFR-REL-4):** Transactional Database Operations (Atomic multi-step mutations rolling back on error).
- **NFR-5 (NFR-REL-5):** Zero Data Loss via Local-First Snapshot (Browser IndexedDB replica remains authoritative if cloud is wiped).
- **NFR-6 (NFR-SEC-1):** Layered Rate Limiting (Global 100 req/min; Auth tier 5 req/min with `Retry-After`).
- **NFR-7 (NFR-SEC-2):** Security Headers & Strict CORS (`@fastify/helmet`, restricted origins).
- **NFR-8 (NFR-SEC-3):** Zero Data Leakage in Errors (Uniform envelope, no production stack traces).
- **NFR-9 (NFR-SEC-4):** Strict Multi-Tenant Scoping (All queries enforce `WHERE user_id = :userId`).
- **NFR-10 (NFR-SEC-5):** Timing Attack & User Enumeration Defense (Constant-time password check `timingSafeEqual`, dummy hash on nonexistent emails).
- **NFR-11 (NFR-OBS-1):** Structured Pino Logging & Redaction (JSON logs with UUID request IDs; credentials redacted).
- **NFR-12 (NFR-OBS-2):** Dual Health Probes (`/health/live` and `/health/ready`).
- **NFR-13 (NFR-AI-1):** LLM Request Timeout & Retries (15s timeout, 3 retries with exponential backoff and jitter).
- **NFR-14 (NFR-AI-2):** Asynchronous Review Queue & Rate Protection (10 req / 10 min per user, max 3,000 token ceiling, async queue).
- **NFR-15 (NFR-PERF-1):** API Latency Budget (Core Journal CRUD p95 < 150ms).
- **NFR-16 (NFR-PERF-2):** Ponytail Code Minimalism & TDD (Native platform APIs first, Red-Green TDD, diffs < 50 lines).
- **NFR-17 (NFR-PERF-3):** Client-Side Media Compression (In-browser image downscaling reduces binary upload payloads by >90%).

---

## 3. Disaster Recovery & Zero Data Loss Guarantee

If Azure PostgreSQL suffers catastrophic corruption or unrecoverable loss:
1. The user's device retains the full local snapshot in browser **IndexedDB**.
2. The user can export this snapshot locally as a JSON+Images archive at any time.
3. The user can re-seed an empty or new backend deployment using the batch restore endpoint (`POST /api/journal/restore`).
