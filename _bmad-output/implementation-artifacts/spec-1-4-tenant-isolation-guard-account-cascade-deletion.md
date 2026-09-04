---
title: 'Story 1.4: Tenant Isolation Guard & Account Cascade Deletion'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '53d964b'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Authenticated users require strict tenant data isolation so requests access only their own data. Furthermore, users require complete data sovereignty and the right to erasure (GDPR) via an atomic account cascade deletion that removes their user record and all associated data.

**Approach:** Implement Fastify authentication guard (`authenticate` preHandler hook) that extracts and validates Bearer tokens using native `node:crypto` `verifyJwt`, verifies user existence in the repository, and decorates `request.user` with `{ userId, email }`. Provide `GET /api/auth/me` to expose verified user identity, and `DELETE /api/auth/account` to execute an atomic transactional purge (`db.transaction`) removing the user and all associated database records.

## Boundaries & Constraints

**Always:**
- Enforce uniform error envelope `{ "error": { "code": string, "message": string } }` for all errors (HTTP 401 for unauthorized).
- Missing, malformed, expired, tampered tokens, or non-existent/deleted users must return HTTP 401 with `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.
- Verified user identity (`userId`, `email`) must be attached to `request.user` prior to protected route execution.
- Account deletion (`DELETE /api/auth/account`) must execute within a managed database transaction (`db.transaction`) ensuring atomic removal of the user record and associated relational records.
- After account deletion, subsequent requests with the previously valid JWT must immediately fail with HTTP 401 UNAUTHORIZED.
- Maintain diffs under 50 lines and follow strict Red-Green TDD (Ponytail).

**Ask First:**
- Introducing third-party session/auth plugins (`@fastify/auth`, `passport`) when native Fastify preHandler hooks satisfy requirements.

**Never:**
- Never allow unauthenticated requests or invalid tokens to proceed to protected route handlers.
- Never leak sensitive user attributes (e.g. `passwordHash`) through `GET /api/auth/me` or any endpoint.
- Never perform non-transactional partial deletions during account purge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid authenticated request | `GET /api/auth/me` with `Authorization: Bearer <valid_token>` | HTTP 200 `{ "userId": "<UUID>", "email": "user@example.com" }` | N/A |
| Missing Authorization header | `GET /api/auth/me` with no `Authorization` header | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Reject in guard |
| Non-Bearer Authorization header | `GET /api/auth/me` with `Authorization: Basic 12345` | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Reject in guard |
| Tampered JWT signature | `GET /api/auth/me` with altered token characters | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Reject in guard via `verifyJwt` |
| Expired JWT token | `GET /api/auth/me` with token past expiration | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Reject in guard via `verifyJwt` |
| Token for deleted/non-existent user | `GET /api/auth/me` with valid signature for unknown user ID | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Reject in guard |
| Atomic account deletion | `DELETE /api/auth/account` with valid JWT Bearer token | HTTP 200 `{ "status": "deleted" }`, user row removed from DB within transaction | N/A |
| Access after account deletion | `GET /api/auth/me` or `DELETE /api/auth/account` using token of deleted user | HTTP 401 `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }` | Guard rejects deleted user |

</frozen-after-approval>

## Code Map

- `server/src/modules/auth/auth.types.ts` -- Domain interfaces and errors: `AuthenticatedUser`, `UnauthorizedError`, `IUserRepository.findById()`, `IUserRepository.deleteById()`, `IAuthService.getUserById()`, `IAuthService.deleteAccount()`.
- `server/src/modules/auth/auth.guard.ts` -- Fastify `preHandler` authentication guard extracting Bearer token, verifying JWT via `verifyJwt`, verifying user existence, and decorating `request.user`.
- `server/src/modules/auth/auth.service.ts` -- Implementation of `getUserById()` and `deleteAccount()` with transactional deletion.
- `server/src/modules/auth/auth.routes.ts` -- Register protected routes: `GET /api/auth/me` and `DELETE /api/auth/account`.
- `server/src/app.ts` -- Decorate Fastify request with `user` property (`app.decorateRequest('user', null)`).
- `server/tests/auth.test.ts` -- Comprehensive TDD test suite covering AC1 (valid auth & request.user injection), AC2 (unauthorized cases, missing/tampered/expired tokens), AC3 (atomic account deletion & post-deletion rejection).

## Tasks & Acceptance

**Execution:**
- [x] `server/src/modules/auth/auth.types.ts` -- Add `AuthenticatedUser`, `UnauthorizedError`, repository methods, and service methods.
- [x] `server/src/modules/auth/auth.service.ts` -- Implement `findById()` & `deleteById()` in repository, and `getUserById()` & `deleteAccount()` in `AuthService`.
- [x] `server/src/modules/auth/auth.guard.ts` -- Implement `authenticate` hook with uniform 401 error envelope.
- [x] `server/src/app.ts` -- Decorate request with `user` attribute.
- [x] `server/src/modules/auth/auth.routes.ts` -- Wire `GET /me` and `DELETE /account` with `authenticate` preHandler.
- [x] `server/tests/auth.test.ts` -- Red-Green TDD test suites for all scenarios.

**Acceptance Criteria:**
- Given a valid signed JWT Bearer token in the `Authorization` header, when accessing protected routes (e.g. `GET /api/auth/me`), response is 200 with `{ "userId": "<UUID>", "email": "user@example.com" }`, handler receives verified `userId` directly from `request.user`.
- Given missing, expired, tampered token, or deleted user, response status is 401 with `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`.
- Given authenticated user, when sending `DELETE /api/auth/account`, response is 200 with `{ "status": "deleted" }`, user record in `users` and all associated records are atomically removed in a single transaction.

## Verification

**Commands:**
- `npm test` -- All unit and integration tests pass with 0 failures.
