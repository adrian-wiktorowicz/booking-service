---
title: 'Story 2.2: Retrieve Entry by Date & Chronological Paginated History'
type: 'feature'
created: '2026-09-05'
status: 'done'
baseline_commit: '06cff6a'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md', '_bmad-output/planning-artifacts/epics.md', '_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Authenticated users cannot inspect a specific past day's journal entry or browse their chronological journal history. The system must support viewing an entry by calendar date, paginating entries descending by date, and filtering by inclusive date ranges while strictly enforcing tenant isolation and calendar date validity.

**Approach:** Extend `JournalService`, `IJournalRepository`, `DrizzleJournalRepository`, and Fastify `journalRoutes` to add `GET /api/journal/entries/:date` (single entry lookup with IDOR defense) and `GET /api/journal/entries` (chronological paginated history with `entry_date DESC`, `page`, `limit` [max 50], and inclusive `startDate`/`endDate` filtering).

## Boundaries & Constraints

**Always:**
- Uniform error envelope `{ "error": { "code": string, "message": string } }` across all endpoints.
- Single-date lookup `GET /api/journal/entries/:date` returns HTTP 200 with entry details or HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` if absent or owned by another user (preventing IDOR).
- Invalid date parameter or filter (`:date`, `startDate`, `endDate`) returns HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": string } }`.
- Date range validation: if both `startDate` and `endDate` are provided and `startDate > endDate`, return HTTP 422 with `{ "error": { "code": "VALIDATION_ERROR", "message": "startDate must not be after endDate" } }`.
- Pagination constraints: default `page=1`, default `limit=20`, maximum `limit=50`. Values violating constraints return HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }`.
- Paginated response format: `{ "entries": [...], "pagination": { "page": number, "limit": number, "total": number, "hasMore": boolean } }`.
- Results ordered chronologically descending (`entry_date DESC`).
- Strict tenant boundary: all SQL queries filter on `WHERE user_id = :userId`.
- Unauthenticated requests return HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.
- Ponytail minimalism: native JS `Date` UTC validation; no additional date/pagination libraries.
- Strict Red-Green TDD: write failing unit & route integration tests before implementation.

**Ask First:**
- Increasing max pagination limit beyond 50 or changing pagination envelope shape.

**Never:**
- Never leak entries across users or reveal whether another user has an entry on a date (return 404, never 403).
- Never execute database queries directly in Fastify route handlers (preserve layered architecture).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Existing entry lookup | `GET /api/journal/entries/2026-09-03` for existing date | HTTP 200 with entry `{ id, userId, entryDate: '2026-09-03', notes, mood, tags, createdAt, updatedAt }` | N/A |
| Non-existent date lookup | `GET /api/journal/entries/2026-09-03` (no entry for user) | HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` | Service throws `EntryNotFoundError` |
| IDOR date lookup | `GET /api/journal/entries/2026-09-03` (entry exists for user B, caller is user A) | HTTP 404 `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }` | Tenant-scoped query returns null -> 404 |
| Invalid date param | `GET /api/journal/entries/2026-02-30` or `not-a-date` | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | `isValidCalendarDate` fails |
| Unauthenticated lookup | `GET /api/journal/entries/2026-09-03` without auth token | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Auth guard |
| Paginated list (defaults) | `GET /api/journal/entries` (user has entries) | HTTP 200 `{ entries: [...], pagination: { page: 1, limit: 20, total: N, hasMore: boolean } }` sorted `entry_date DESC` | N/A |
| Paginated list (page & limit) | `GET /api/journal/entries?page=2&limit=5` | HTTP 200 with up to 5 items offset by 5; `hasMore` true if `offset + count < total` | N/A |
| Date range filtering | `GET /api/journal/entries?startDate=2026-08-01&endDate=2026-08-31` | HTTP 200 with entries where `entry_date >= '2026-08-01'` and `entry_date <= '2026-08-31'` | SQL `gte` and `lte` |
| Single filter boundary | `GET /api/journal/entries?startDate=2026-09-01` | HTTP 200 with entries from that date onwards | SQL `gte` |
| Inverted date range | `GET /api/journal/entries?startDate=2026-09-10&endDate=2026-09-01` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "startDate must not be after endDate" } }` | Validation error |
| Invalid filter date format | `GET /api/journal/entries?startDate=2026-02-30` | HTTP 422 `{ "error": { "code": "INVALID_DATE", "message": "Invalid calendar date" } }` | `isValidCalendarDate` fails |
| Invalid limit (> 50) | `GET /api/journal/entries?limit=51` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Fastify schema validator |
| Empty list for user | `GET /api/journal/entries` (new user with 0 entries) | HTTP 200 `{ entries: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } }` | N/A |

</frozen-after-approval>

## Code Map

- `server/src/modules/journal/journal.types.ts` -- Add `EntryNotFoundError`, `JournalFilterOptions`, `PaginatedJournalEntriesResponse`, and extend `IJournalRepository` & `IJournalService`.
- `server/src/modules/journal/journal.service.ts` -- Implement `getEntryByDate` and `getEntries` with date/filter validation and pagination math.
- `server/src/modules/journal/journal.repository.ts` -- Implement `findByDate` and `findMany` using Drizzle ORM `eq`, `and`, `gte`, `lte`, `count`, `desc`, `limit`, `offset`.
- `server/src/modules/journal/journal.routes.ts` -- Register `GET /entries/:date` and `GET /entries` routes with preHandler `authenticate` and Fastify schema validation.
- `server/tests/journal.test.ts` -- Update `InMemoryJournalRepository` and add comprehensive TDD test cases verifying all acceptance criteria.

## Tasks & Acceptance

**Execution:**
- [x] `server/src/modules/journal/journal.types.ts` -- Define `EntryNotFoundError`, query filter types, and update repository/service interfaces.
- [x] `server/tests/journal.test.ts` -- Update `InMemoryJournalRepository` and author failing unit and route integration tests (Red phase).
- [x] `server/src/modules/journal/journal.service.ts` -- Implement `getEntryByDate` and `getEntries` methods in `JournalService`.
- [x] `server/src/modules/journal/journal.repository.ts` -- Implement `findByDate` and `findMany` with pagination and date range queries in `DrizzleJournalRepository`.
- [x] `server/src/modules/journal/journal.routes.ts` -- Wire routes `GET /entries/:date` and `GET /entries` with Fastify schemas and auth guard.
- [x] Verify test suite passes with 100% green status and 0 TypeScript errors.

**Acceptance Criteria:**
- Given an existing entry for date `2026-09-03` belonging to the authenticated user, when `GET /api/journal/entries/2026-09-03`, then status 200 with entry details.
- Given no entry exists for date `2026-09-03` for the authenticated user, when `GET /api/journal/entries/2026-09-03`, then status 404 with `{ "error": { "code": "ENTRY_NOT_FOUND", "message": "No entry found for this date" } }`.
- Given an authenticated user with multiple entries, when `GET /api/journal/entries?page=1&limit=20`, then status 200 with `{ "entries": [...], "pagination": { "page": 1, "limit": 20, "total": N, "hasMore": boolean } }` sorted `entry_date DESC`.
- Given date filters `startDate=2026-08-01` and `endDate=2026-08-31`, when `GET /api/journal/entries?startDate=2026-08-01&endDate=2026-08-31`, then only entries within that inclusive range are returned.

## Spec Change Log

## Design Notes

- Date validation reuse: Reuse `isValidCalendarDate(dateStr)` from `journal.service.ts` to validate `:date`, `startDate`, and `endDate`.
- Date range check: Since valid calendar dates are in `YYYY-MM-DD` format, lexicographical comparison (`startDate > endDate`) is strictly identical to chronological comparison.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: Clean TypeScript check with 0 errors.
- `npm test` -- expected: Vitest executes all unit and route integration tests with 100% passing.

## Suggested Review Order

**HTTP Endpoints & Validation Schemas**

- Fastify route registration and parameter/querystring schemas for single-date lookup and paginated listing
  [`journal.routes.ts:24`](../../server/src/modules/journal/journal.routes.ts#L24)

**Domain Service & Validation**

- Calendar date validation, IDOR protection, range checks, and pagination orchestration
  [`journal.service.ts:80`](../../server/src/modules/journal/journal.service.ts#L80)

- Clean response formatting with defensive copy of tags
  [`journal.service.ts:24`](../../server/src/modules/journal/journal.service.ts#L24)

**Data Access & Drizzle ORM Queries**

- Single-date lookup and paginated SQL queries with date filtering and count
  [`journal.repository.ts:38`](../../server/src/modules/journal/journal.repository.ts#L38)

**Types & Test Suite**

- Domain interfaces, error classes, and repository/service contracts
  [`journal.types.ts:57`](../../server/src/modules/journal/journal.types.ts#L57)

- Unit and HTTP integration tests covering happy paths, edge cases, and error envelopes
  [`journal.test.ts:371`](../../server/tests/journal.test.ts#L371)

