---
title: 'Story 2.3: Delete Journal Entry'
type: 'feature'
created: '2026-09-05'
status: 'done'
baseline_commit: 'e2089aa'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md', '_bmad-output/planning-artifacts/epics.md', '_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Authenticated users cannot permanently delete a specific journal entry. The system must allow users to delete their entry for any calendar date while strictly preventing Insecure Direct Object References (IDOR) and validating calendar dates.

**Approach:** Extend `IJournalRepository`, `DrizzleJournalRepository`, `IJournalService`, `JournalService`, and Fastify `journalRoutes` to add `DELETE /api/journal/entries/:date`, returning `{ "status": "deleted" }` or HTTP 404 if nonexistent or owned by another user.

## Boundaries & Constraints

**Always:**
- Uniform error envelope `{ "error": { "code": string, "message": string } }` across all endpoints.
- Single-date deletion `DELETE /api/journal/entries/:date` returns HTTP 200 with `{ "status": "deleted" }` on success.
- If no entry exists for the specified date for the authenticated user, return HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` (preventing IDOR).
- Invalid date parameter (`:date`) returns HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }`.
- Strict tenant boundary: all SQL delete queries filter on `WHERE user_id = :userId AND entry_date = :entryDate`.
- Unauthenticated requests return HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.
- Ponytail minimalism: reuse `isValidCalendarDate(dateStr)`; zero new external libraries; minimal surgical diffs.
- Strict Red-Green TDD: write failing unit & route integration tests before implementation.

**Ask First:**
- Any soft-delete or retention requirements (AC specifies permanent atomic deletion).

**Never:**
- Never leak whether another user has an entry on a date (return 404, never 403).
- Never execute database queries directly in Fastify route handlers (preserve layered architecture).
- Never execute a delete query without tenant scoping (`WHERE user_id = :userId`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Existing entry deletion | `DELETE /api/journal/entries/2026-09-03` for user's entry | HTTP 200 `{ "status": "deleted" }` and row permanently removed | N/A |
| Non-existent date deletion | `DELETE /api/journal/entries/2026-09-03` (no entry for user) | HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` | Service throws `EntryNotFoundError` |
| IDOR deletion attempt | `DELETE /api/journal/entries/2026-09-03` (entry exists for user B, caller is user A) | HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` | Tenant-scoped delete deletes 0 rows -> 404 |
| Invalid date parameter | `DELETE /api/journal/entries/2026-02-30` or `not-a-date` | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | `isValidCalendarDate` fails -> `InvalidDateError` |
| Unauthenticated deletion | `DELETE /api/journal/entries/2026-09-03` without auth token | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Auth guard |
| Idempotent second delete | Second `DELETE /api/journal/entries/2026-09-03` right after successful delete | HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` | Row no longer exists -> 404 |

</frozen-after-approval>

## Code Map

- `server/src/modules/journal/journal.types.ts` -- Add `deleteByDate` to `IJournalRepository` and `deleteEntry` to `IJournalService`.
- `server/src/modules/journal/journal.repository.ts` -- Implement `deleteByDate` in `DrizzleJournalRepository` using Drizzle ORM `.delete(journalEntries).where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, entryDate))).returning({ id: journalEntries.id })`.
- `server/src/modules/journal/journal.service.ts` -- Implement `deleteEntry(userId, dateStr)` validating calendar date, delegating to `journalRepo.deleteByDate`, throwing `EntryNotFoundError` if false, and returning `{ status: 'deleted' }`.
- `server/src/modules/journal/journal.routes.ts` -- Register `DELETE /entries/:date` route with `preHandler: [authenticate]`, params schema validation, delegating to `journalService.deleteEntry`.
- `server/tests/journal.test.ts` -- Update `InMemoryJournalRepository.deleteByDate` and add unit and route integration tests covering all matrix scenarios.

## Tasks & Acceptance

**Execution:**
- [x] `server/src/modules/journal/journal.types.ts` -- Add `deleteByDate` and `deleteEntry` method contracts to repository and service interfaces.
- [x] `server/tests/journal.test.ts` -- Update `InMemoryJournalRepository` and author failing unit and route integration tests for deletion (Red phase).
- [x] `server/src/modules/journal/journal.service.ts` -- Implement `deleteEntry` with date validation and not-found handling.
- [x] `server/src/modules/journal/journal.repository.ts` -- Implement `deleteByDate` in `DrizzleJournalRepository`.
- [x] `server/src/modules/journal/journal.routes.ts` -- Wire route `DELETE /entries/:date` with Fastify schema and auth guard.
- [x] Verify test suite passes with 100% green status and 0 TypeScript errors.

**Acceptance Criteria:**
- Given an existing entry for date `2026-09-03` belonging to the authenticated user, when `DELETE /api/journal/entries/2026-09-03`, then status 200 with `{ "status": "deleted" }` and the row is removed.
- Given no entry exists for date `2026-09-03` for the authenticated user, when `DELETE /api/journal/entries/2026-09-03`, then status 404 with `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }`.
- Given an entry for date `2026-09-03` belonging to User B, when User A sends `DELETE /api/journal/entries/2026-09-03`, then status 404 with `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` and User B's entry remains untouched.

## Spec Change Log

## Design Notes

- Reuse `isValidCalendarDate(dateStr)` from `journal.service.ts`.
- In `DrizzleJournalRepository`, using `.returning({ id: journalEntries.id })` provides an atomic indication of whether a row was deleted matching both `userId` and `entryDate`.

## Verification

**Commands:**
- `npx --prefix server tsc -p server/tsconfig.json --noEmit` -- expected: Clean TypeScript check with 0 errors.
- `npm --prefix server test` -- expected: Vitest executes all unit and route integration tests with 100% passing.
