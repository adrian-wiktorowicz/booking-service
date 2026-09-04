---
title: 'Story 1.3: User Login, JWT Issuance & Anti-Enumeration Defense'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: '934a2b2'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Registered users need to authenticate securely using email and password to receive a signed JWT session token for accessing private journal data, while protecting the system against credential brute-forcing, timing attacks, and user enumeration.

**Approach:** Implement `POST /api/auth/login` endpoint with constant-time password verification using precomputed static `DUMMY_HASH` (bcrypt cost factor 12) and `crypto.timingSafeEqual`, native `node:crypto` HMAC-SHA256 JWT generation (standard claims `sub`, `userId`, `iat`, `exp`), and IP-based rate limiting via `@fastify/rate-limit` (max 5 requests/min with `Retry-After` header and uniform error envelope).

## Boundaries & Constraints

**Always:**
- Enforce uniform error envelope `{ "error": { "code": string, "message": string } }` on all error responses (401 for invalid credentials, 422 for validation, 429 for rate limit).
- Execute `pepperPassword()` unconditionally on `input.password` before checking account existence.
- Nonexistent email lookups must run `bcrypt.compare()` against static precomputed `DUMMY_HASH` (cost factor 12) so verification latency is indistinguishable between existing and non-existing users (~250ms).
- Use `crypto.timingSafeEqual` over fixed-length SHA-256 digests to prevent timing leaks or `RangeError` exceptions.
- JWT session tokens must be signed with HMAC-SHA256 using `JWT_SECRET` (>= 32 chars) and expire in 86400 seconds (24h). Payload must include `userId`, `sub`, `iat`, and `exp`.
- Send `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` on successful login responses.
- Enforce rate limit of 5 requests per minute per IP on `POST /api/auth/login` returning HTTP 429 with `Retry-After` header.
- Maintain diffs under 50 lines and follow strict Red-Green TDD (AD-5, Ponytail).

**Ask First:**
- Adding third-party token libraries (`jsonwebtoken`, `@fastify/jwt`) when native `node:crypto` satisfies requirements.

**Never:**
- Never return distinct error messages for incorrect password vs unknown email.
- Never leak plain text passwords, pepper secrets, or JWT secrets in API responses or logs.
- Never compute dummy bcrypt hash dynamically inside the login handler (causes 2x latency discrepancy).
- Never allow bypass of rate limits due to missing proxy configuration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid login | `POST /api/auth/login` with `{ "email": "user@example.com", "password": "SecurePassword123" }`, valid user in DB | HTTP 200 `{ "token": "<JWT>", "expiresIn": 86400 }`, `Cache-Control: no-store` | N/A |
| Incorrect password | `POST /api/auth/login` with valid email, incorrect password | HTTP 401 `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` | Reject with constant-time verification |
| Nonexistent email | `POST /api/auth/login` with email not in DB | HTTP 401 `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` | Execute `bcrypt.compare` against `DUMMY_HASH` before rejecting |
| Null byte in email | `POST /api/auth/login` with `user\0@example.com` | HTTP 401 `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }` | Reject with constant-time verification |
| Missing/malformed fields | `POST /api/auth/login` with `{ "email": "not-an-email" }` or `{}` | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Fastify schema rejection |
| Oversized password (>72 chars) | `POST /api/auth/login` with password > 72 chars | HTTP 422 `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed" } }` | Fastify schema rejection |
| Rate limit exceeded (>5 req/min) | 6th `POST /api/auth/login` request within 1 min from same IP | HTTP 429 `{ "error": { "code": "RATE_LIMITED", "message": "Too many login attempts. Please retry later." } }`, `Retry-After: <seconds>` | Fastify rate limiter rejection |

</frozen-after-approval>

## Code Map

- `server/src/modules/auth/jwt.ts` -- Native `node:crypto` JWT signer and verifier (<35 lines) enforcing HS256, standard claims, and timing-safe signature checking.
- `server/src/modules/auth/auth.types.ts` -- Domain types: `LoginInput`, `LoginResponse`, `InvalidCredentialsError`, `IJwtSigner`.
- `server/src/modules/auth/auth.service.ts` -- Domain logic: static `DUMMY_HASH`, constant-time timingSafeEqual verification, pepper application, token issuance.
- `server/src/modules/auth/auth.routes.ts` -- Fastify route plugin for `POST /api/auth/login` with schema validation and route-level rate limiting.
- `server/src/app.ts` -- Registers `@fastify/rate-limit` with custom `errorResponseBuilder`, `trustProxy` setting, and error envelope handling.
- `server/tests/auth.test.ts` -- TDD test suites covering AC1 (valid login), AC2 (invalid credentials + timing attack resilience), AC3 (rate limiting + Retry-After), and schema edge cases.

## Tasks & Acceptance

**Execution:**
- [x] `server/package.json` -- Install `@fastify/rate-limit` dependency.
- [x] `server/src/modules/auth/jwt.ts` -- Implement native Node.js 22 `node:crypto` JWT signing & verification.
- [x] `server/src/modules/auth/auth.types.ts` -- Declare `LoginInput`, `LoginResponse`, `InvalidCredentialsError`.
- [x] `server/src/modules/auth/auth.service.ts` -- Implement `login()` in `AuthService` with static `DUMMY_HASH` and constant-time verification.
- [x] `server/src/app.ts` -- Configure `@fastify/rate-limit` plugin with uniform 429 error envelope and `trustProxy`.
- [x] `server/src/modules/auth/auth.routes.ts` -- Register `POST /api/auth/login` route with rate limit (5/min), schema validation, and cache headers.
- [x] `server/tests/auth.test.ts` -- Unit and integration tests for valid login, invalid credentials, timing consistency, schema validation, and rate limiting.

**Acceptance Criteria:**
- Given a registered user with valid credentials, when sending `POST /api/auth/login`, response status is 200 with `{ "token": "<JWT>", "expiresIn": 86400 }`, JWT payload contains `userId` and `exp`.
- Given incorrect password or non-existing email, when sending `POST /api/auth/login`, response status is 401 with `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }`, execution time is indistinguishable between existing and non-existing users.
- Given client IP exceeding 5 login requests in 1 minute, response status is 429 with `{ "error": { "code": "RATE_LIMITED", "message": "Too many login attempts. Please retry later." } }` and `Retry-After` header.

## Verification

**Commands:**
- `npm test` -- All unit and integration tests pass with 0 failures.
