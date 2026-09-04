---
title: 'Story 2.1: Daily Entry Schema, Semantic Mood & Upsert'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'c1ab0e4'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md', '_bmad-output/planning-artifacts/epics.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Authenticated users need to record and update daily journal entries (text notes, semantic mood rating, tags) for any calendar date. The system must prevent duplicate entries for the same date per user, ensure true calendar date validity (rejecting nonexistent days like 2026-02-30), reject invalid moods or oversized payloads, and cascade-delete entries when a user account is deleted.

**Approach:** 
1. Define `journal_entries` in Drizzle ORM schema with foreign key cascade to `users`, composite unique constraint `(user_id, entry_date)`, and index on `(entry_date)`.
2. Implement date validation using native JavaScript `Date` UTC methods to detect nonexistent calendar dates (e.g. `2026-02-30`).
3. Implement `JournalService` providing an idempotent upsert (`saveEntry`) targeting `(user_id, entry_date)`.
4. Register `PUT /api/journal/entries/:date` in Fastify behind the `authenticate` guard, validating payload limits (notes <= 50,000 chars, tags <= 10 items, mood in `['bad', 'neutral', 'good', 'very_good']`).

## Boundaries & Constraints

**Always:**
- Enforce uniform error envelope `{ "error": { "code": string, "message": string } }` across all endpoints.
- Invalid date parameter (format or calendar date e.g. `2026-02-30`) returns HTTP 422 with `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }`.
- Invalid mood value outside `['bad', 'neutral', 'good', 'very_good']` returns HTTP 422 with `{ "error": { "code": "VALIDATION_ERROR", "message": "Mood must be one of: bad, neutral, good, very_good" } }`.
- Notes exceeding 50,000 characters or tags count exceeding 10 items returns HTTP 422 with `{ "error": { "code": "VALIDATION_ERROR", "message": string } }`.
- Missing or invalid auth Bearer token returns HTTP 401 with `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.
- Upsert operation on `(user_id, entry_date)` returns HTTP 200 with `{ id, userId, entryDate, notes, mood, tags, createdAt, updatedAt }`.
- Cascade deletion: deleting user removes all corresponding journal entries.
- Use native standard library for date validation and zero speculative dependencies (Ponytail).
- Red-Green TDD: failing tests written and verified before implementation.

**Ask First:**
- Adding third-party date libraries (e.g. date-fns, dayjs) when native `Date` handles `YYYY-MM-DD` validation cleanly.

**Never:**
- Never allow duplicate entries for the same user and date.
- Never write database queries directly inside Fastify route handlers (Architecture AD-1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Code / Handling |
|---|---|---|---|
| Valid new entry creation | `PUT /api/journal/entries/2026-09-03` with notes, mood: 'good', tags: ['coding', 'walk'] | HTTP 200 `{ id: UUID, userId, entryDate: '2026-09-03', notes, mood: 'good', tags: ['coding', 'walk'], createdAt, updatedAt }` | N/A |
| Valid upsert on existing entry | `PUT /api/journal/entries/2026-09-03` with updated notes and mood: 'very_good' | HTTP 200 with updated fields; existing record updated in DB with same `id`, updated `updatedAt` | N/A |
| Non-existent calendar date | `PUT /api/journal/entries/2026-02-30` | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | Native Date verification detects day mismatch |
| Leap year edge case (invalid) | `PUT /api/journal/entries/2026-02-29` (2026 is not leap) | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | Native Date verification |
| Leap year edge case (valid) | `PUT /api/journal/entries/2024-02-29` (2024 is leap) | HTTP 200 with saved entry | Success |
| Malformed date string | `PUT /api/journal/entries/not-a-date` | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | Regex & Date verification |
| Invalid mood value | `PUT /api/journal/entries/2026-09-03` with `{ mood: 'ecstatic' }` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Mood must be one of: bad, neutral, good, very_good" } }` | Schema / domain validator |
| Notes exceed 50,000 chars | `PUT /api/journal/entries/2026-09-03` with notes.length = 50,001 | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Notes must not exceed 50000 characters" } }` | Schema validator |
| Tags count exceeds 10 | `PUT /api/journal/entries/2026-09-03` with 11 tags | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Tags must not exceed 10 items" } }` | Schema validator |
| Optional notes / tags | `PUT /api/journal/entries/2026-09-03` with `{ mood: 'neutral' }` | HTTP 200 with `notes: ''` and `tags: []` | Defaults applied |
| Unauthenticated request | `PUT /api/journal/entries/2026-09-03` without auth header | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Auth guard |
| Cascade deletion | User account deleted via `DELETE /api/auth/account` | User's journal entries are removed from `journal_entries` | DB foreign key cascade |

</frozen-after-approval>

## Code Map

- `server/src/db/schema.ts` -- Define `journal_entries` table with FK cascade to `users.id`, `entryDate`, `notes`, `mood`, `tags`, `unique(user_id, entry_date)`, and index on `entry_date`.
- `server/src/modules/journal/journal.types.ts` -- Types: `Mood`, `JournalEntry`, `UpsertJournalEntryInput`, `IJournalRepository`, `IJournalService`.
- `server/src/modules/journal/journal.service.ts` -- Service implementing calendar date validation (`isValidCalendarDate`) and upsert logic.
- `server/src/modules/journal/journal.repository.ts` -- Drizzle implementation of `IJournalRepository` with PostgreSQL upsert `onConflictDoUpdate`.
- `server/src/modules/journal/journal.routes.ts` -- Fastify route plugin for `PUT /api/journal/entries/:date` with auth guard and JSON schema validation.
- `server/src/app.ts` -- Register `journalRoutes` under `/api/journal`.
- `server/tests/journal.test.ts` -- Comprehensive TDD test suite verifying all acceptance criteria and edge-case matrix scenarios.

## Tasks & Acceptance

**Execution:**
- [x] `server/src/db/schema.ts` -- Add `journalEntries` schema with FK cascade, unique constraint, and indexes.
- [x] `server/src/modules/journal/journal.types.ts` -- Add domain types, mood constants, and repository/service interfaces.
- [x] `server/tests/journal.test.ts` -- Author failing unit and HTTP route integration tests (Red phase).
- [x] `server/src/modules/journal/journal.service.ts` -- Implement `JournalService` and `isValidCalendarDate`.
- [x] `server/src/modules/journal/journal.repository.ts` -- Implement `DrizzleJournalRepository`.
- [x] `server/src/modules/journal/journal.routes.ts` -- Implement Fastify plugin with Fastify/AJV schemas and error handling.
- [x] `server/src/app.ts` -- Wire `journalRoutes`.
- [x] Run verification tests (Green phase) and Ponytail review audit.

## Verification

**Commands:**
- `npx tsc --noEmit` -- Type check passes with 0 errors.
- `npm test` -- Vitest passes all tests with 100% success rate.
