---
title: 'Story 1.2: User Registration & Password Hashing'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users need a private, secure workspace to store their daily journal entries and reflections, which requires authenticated accounts with protected credentials.

**Approach:** Implement `users` database schema using Drizzle ORM, secure password hashing using bcrypt with work factor >= 12, Fastify input validation, and a `POST /api/auth/register` route returning a uniform error envelope on conflict or validation failures.

## Boundaries & Constraints

**Always:**
- Enforce uniform error envelope `{ "error": { "code": string, "message": string } }` on all error responses (409 for duplicate email, 422 for validation error).
- Plain text passwords must never be stored or logged.
- Password hashing must use bcrypt with work factor (salt rounds) >= 12.
- Input validation: email must be a valid email format, password must have minimum length of 8 characters.
- Fastify routes delegate to `AuthService` rather than accessing database queries or Drizzle tables directly (AD-1).
- Maintain diffs under 50 lines and use Red-Green TDD (AD-5, Ponytail).

**Ask First:**
- Adding additional third-party dependencies beyond `bcryptjs` and `@types/bcryptjs`.
- Altering the `users` database table schema structure or naming conventions.

**Never:**
- Never return or leak plain text passwords or password hashes in API responses.
- Never leak stack traces or internal database errors to clients (NFR8).
- Never allow duplicate email registrations in the database.
- Never write database queries directly inside Fastify route handlers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid registration | `POST /api/auth/register` with `{ "email": "user@example.com", "password": "SecurePassword123" }`, email unregistered | HTTP 201 `{ "userId": "<UUID>", "email": "user@example.com" }`, password hashed with 12 rounds in DB | N/A |
| Duplicate email | `POST /api/auth/register` with `{ "email": "user@example.com", "password": "SecurePassword123" }`, email already exists | HTTP 409 `{ "error": { "code": "EMAIL_EXISTS", "message": "Email already registered" } }` | Reject without modifying DB |
| Malformed email | `POST /api/auth/register` with `{ "email": "not-an-email", "password": "SecurePassword123" }` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Schema validation rejection |
| Short password (< 8 chars) | `POST /api/auth/register` with `{ "email": "user@example.com", "password": "short" }` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Schema validation rejection |
| Missing email or password | `POST /api/auth/register` with `{ "email": "user@example.com" }` or `{}` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Schema validation rejection |
| Extra unexpected properties | `POST /api/auth/register` with `{ "email": "user@example.com", "password": "password123", "role": "admin" }` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Schema validation rejection (`additionalProperties: false`) |

</frozen-after-approval>

## Code Map

- `server/src/db/schema.ts` -- Drizzle ORM schema defining `users` table (`id` UUID, `email` unique text with B-tree index, `password_hash` text, `created_at` timestamp with timezone).
- `server/src/modules/auth/auth.types.ts` -- Interfaces for `RegisterInput`, `UserResponse`, `UserRecord`, and `IAuthService`.
- `server/src/modules/auth/auth.service.ts` -- Pure domain service for password hashing (bcrypt >= 12 rounds) and user registration logic (checking duplicates, creating user).
- `server/src/modules/auth/auth.routes.ts` -- Fastify route plugin registering `POST /api/auth/register` with input schema validation and error handling.
- `server/src/app.ts` -- Mounts `/api/auth` plugin and global error handler for validation envelope formatting.
- `server/tests/auth.test.ts` -- Unit and integration tests covering the I/O & edge-case matrix, password hashing, and duplicate detection with TDD.

## Tasks & Acceptance

**Execution:**
- [x] `server/src/db/schema.ts` -- Create Drizzle ORM schema for `users` table with explicit B-tree index on `email` -- Establishes persistent multi-tenant user storage.
- [x] `server/src/modules/auth/auth.types.ts` -- Define TypeScript contracts for auth domain, service interface, and DTOs -- Provides clear types without coupling presentation to DB.
- [x] `server/src/modules/auth/auth.service.ts` -- Implement `AuthService` handling password hashing (bcrypt work factor 12) and user registration logic -- Isolates core business and security rules.
- [x] `server/src/modules/auth/auth.routes.ts` -- Implement Fastify plugin for `POST /api/auth/register` with schema validation and 409 conflict handling -- Exposes REST registration endpoint according to spec.
- [x] `server/src/app.ts` -- Register auth plugin under `/api/auth` and configure validation error handler for HTTP 422 standard envelope -- Integrates auth routes into server lifecycle.
- [x] `server/tests/auth.test.ts` -- Write test suite covering all cases in I/O & Edge-Case Matrix using Red-Green TDD -- Validates correctness, security boundaries, and error codes.

**Acceptance Criteria:**
- Given a valid, unregistered email and a password of at least 8 characters, when a client sends `POST /api/auth/register`, then the response status is 201 with `{ "userId": "<UUID>", "email": "user@example.com" }`, a row is created in `users` with hashed password, and plaintext password is not leaked.
- Given an existing email in the database, when a client sends `POST /api/auth/register` with the same email, then the response status is 409 with `{ "error": { "code": "EMAIL_EXISTS", "message": "Email already registered" } }` and no new record is created.
- Given malformed email, password < 8 characters, missing fields, or unexpected properties, when a client sends `POST /api/auth/register`, then the response status is 422 with `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }`.

## Spec Change Log

## Design Notes

- In `app.ts`, `setErrorHandler` transforms `error.validation` into `{ error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } }` with HTTP 422 status.
- `AuthService` accepts an injected database client or repository to support fast in-memory mocking during unit and integration test runs without requiring an active PostgreSQL instance.
- Password hashing defaults to `12` rounds of salt using `bcryptjs.hash(password, 12)`.

## Verification

**Commands:**
- `npm test` -- expected: All unit and integration test suites pass with 0 failures.

## Suggested Review Order

**API Entry Point & Request Pipeline**

- Fastify registration endpoint with schema validation and conflict handling
  [`auth.routes.ts:12`](../../server/src/modules/auth/auth.routes.ts#L12)

- Fastify app setup with custom validation and HTTP status error envelope handler
  [`app.ts:24`](../../server/src/app.ts#L24)

**Business Logic & Password Hashing**

- Core user registration logic, bcrypt >= 12 rounds hashing, and race-condition handling
  [`auth.service.ts:31`](../../server/src/modules/auth/auth.service.ts#L31)

**Database Schema & Contracts**

- Drizzle ORM users table schema with UUID PK, unique email, and explicit index
  [`schema.ts:3`](../../server/src/db/schema.ts#L3)

- TypeScript interfaces for auth inputs, records, responses, and errors
  [`auth.types.ts:1`](../../server/src/modules/auth/auth.types.ts#L1)

**Test Suite & Verification**

- Unit and integration tests for valid registration, duplicate checks, and edge cases
  [`auth.test.ts:26`](../../server/tests/auth.test.ts#L26)
