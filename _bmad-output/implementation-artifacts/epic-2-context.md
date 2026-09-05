# Epic 2 Context: Daily Journal Logging & Local-First Offline Resilience

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable authenticated users to capture, read, update, and delete daily journal entries (text notes, semantic mood rating, tags) for any calendar date with immediate local-first IndexedDB persistence, seamless offline operation, and synchronized cloud PostgreSQL persistence.

## Stories

- Story 2.1: Daily Entry Schema, Semantic Mood & Upsert
- Story 2.2: Retrieve Entry by Date & Chronological Paginated History
- Story 2.3: Delete Journal Entry
- Story 2.4: Local-First Browser Snapshot & Offline Persistence (IndexedDB)

## Requirements & Constraints

- Single Entry per Calendar Date: Exactly one journal entry per user per date (`UNIQUE(user_id, entry_date)`). Updating an existing date performs an idempotent upsert.
- Strict Calendar Date Validation: Date parameter must strictly follow ISO-8601 `YYYY-MM-DD` and represent a real calendar date, correctly handling month lengths and leap years (e.g. reject `2026-02-29`, `2026-02-30`). Returns HTTP 422 with `INVALID_DATE` on failure.
- Semantic Mood Rating: Mood ratings are discrete semantic values: `['bad', 'neutral', 'good', 'very_good']`. Invalid ratings return HTTP 422 with `VALIDATION_ERROR`.
- Input & Payload Boundaries: Notes field capped at 50,000 characters; tags capped at 10 items (maximum 30 characters each). Exceeding limits returns HTTP 422 with `VALIDATION_ERROR`.
- Uniform Error Envelope: All errors must conform to `{ "error": { "code": string, "message": string } }` with no internal stack trace exposure.
- Date Retrieval & IDOR Protection: `GET /api/journal/entries/:date` returns the entry details or HTTP 404 with `ENTRY_NOT_FOUND` if the date has no entry or belongs to another user.
- Chronological Paginated History: `GET /api/journal/entries` returns entries sorted descending (`entry_date DESC`). Enforces pagination with default limit of 20 and maximum limit of 50, returning `{ entries, pagination: { page, limit, total, hasMore } }`. Supports inclusive date range filtering (`startDate`, `endDate`).
- Permanent Entry Deletion: `DELETE /api/journal/entries/:date` permanently deletes the entry from the database in an atomic transaction. Returns HTTP 404 with `ENTRY_NOT_FOUND` if nonexistent or owned by another user.
- Local-First Client Persistence: Browser IndexedDB stores entries locally prior to or in parallel with backend sync, providing 0ms perceived latency and full offline journaling resilience.
- Tenant Isolation: All database operations strictly enforce tenant boundaries at the SQL layer (`WHERE user_id = :userId`). Unauthenticated requests return HTTP 401 `UNAUTHORIZED`.
- Performance Budget: Core journal CRUD latency p95 < 150ms.

## Technical Decisions

- Layered Architecture: Strict inward dependency direction. Fastify route handlers handle validation and delegate to pure `JournalService` domain methods. Data access is encapsulated in `DrizzleJournalRepository`. Route controllers never import Drizzle models or execute raw SQL directly.
- Database Schema (`journal_entries`):
  - `id`: UUID v4 primary key (`crypto.randomUUID()`).
  - `user_id`: UUID foreign key to `users.id` with `ON DELETE CASCADE`.
  - `entry_date`: Text column formatted `YYYY-MM-DD`.
  - `notes`: Text column (default empty string, max 50KB).
  - `mood`: Text column constrained to `bad`, `neutral`, `good`, `very_good`.
  - `tags`: JSON/array column for string tags (default empty array).
  - `photo_blob_name`: Text column, nullable (reserved for Epic 3 photo attachments).
  - `created_at`, `updated_at`: Timestamps with timezone.
  - Constraints & Indexes: Composite unique constraint `UNIQUE(user_id, entry_date)`; explicit B-tree indexes on `(user_id, entry_date)` and `(entry_date)`.
- Standard Library First (Ponytail): Date parsing and leap-year validation implemented using native JavaScript UTC Date methods without external date libraries.
- Client Storage: IndexedDB store `journal_entries` keyed by `entryDate` with sync metadata (`synced`, `pending`) to manage offline write queues.

## UX & Interaction Patterns

- Native Browser Controls: Native HTML `<input type="date">` for calendar date selection.
- Semantic Mood Selector: 4-button discrete choice (`bad`, `neutral`, `good`, `very_good`) rather than arbitrary numerical sliders.
- Optimistic & Offline Feedback: 0ms local save response in UI; persistent visual indicator / badge when changes are cached locally and awaiting cloud sync.

## Cross-Story Dependencies

- Foundation (Epic 1): Depends on Epic 1 for Fastify app lifecycle, PostgreSQL connection pool guardrails, JWT authentication guard, and user account cascade deletion.
- Story 2.1 establishes the Drizzle schema, domain models, validation logic, and upsert endpoint.
- Story 2.2 builds on Story 2.1 to implement single-date retrieval, range filtering, and paginated history listing.
- Story 2.3 integrates with the existing repository and routes to provide atomic entry deletion.
- Story 2.4 consumes endpoints from 2.1-2.3 to implement IndexedDB client caching, optimistic updates, and background synchronization.
- Downstream Enabler (Epics 3, 4, 5): Epic 3 attaches photos to entries established in Epic 2. Epics 4 and 5 consume historical entries and mood data for deterministic analytics and AI companion reflections.
