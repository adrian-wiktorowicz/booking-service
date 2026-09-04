# Epic 1 Context: User Authentication & Multi-Tenant Security

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the foundational Fastify server, database connection with Drizzle ORM, secure user authentication with JWT, constant-time password verification, route-level rate limiting, and account cascade deletion so that user data is isolated, protected against timing attacks, and compliant with data privacy requirements.

## Stories

- Story 1.1: Project Skeleton, Health Checks & Production Guardrails
- Story 1.2: User Registration & Password Hashing
- Story 1.3: User Login, JWT Issuance & Anti-Enumeration Defense
- Story 1.4: Tenant Isolation Guard & Account Cascade Deletion

## Requirements & Constraints

- User Registration & Password Hashing: Argon2id or Bcrypt work factor >= 12, duplicate email rejection with HTTP 409, minimum 8 characters password.
- User Authentication & JWT Issuance: Email/password verification, stateless signed JWT with expiry, uniform error responses.
- Tenant Data Isolation Guard: Bearer token authentication, strict SQL tenant scoping WHERE user_id = :userId.
- Account & Cascade Data Deletion: Complete atomic purge of user record and all associated records.
- Database Connection Pool Guardrails: PostgreSQL pool max 20, connectionTimeoutMillis 5000ms, idleTimeoutMillis 10000ms, statement_timeout 3000ms.
- Rate Limiting: Global 100 req/min per IP, Auth routes /api/auth/* 5 req/min per IP with Retry-After header and standard error envelope.
- Security Headers: @fastify/helmet with nosniff, frameguard DENY, HSTS.
- Zero Data Leakage in Errors: Uniform error envelope `{ "error": { "code": string, "message": string } }`, no internal stack traces leaked.
- Timing Attack & User Enumeration Defense: Constant-time password verification via `crypto.timingSafeEqual` and dummy hash comparison on nonexistent emails.
- Ponytail Minimalism & TDD: Native platform APIs and stdlib first, strict Red-Green TDD, diffs kept under 50 lines.

## Technical Decisions

- Layered Modular Architecture: Fastify routes -> pure Domain Services -> Drizzle ORM Data Access.
- Database Schema: `users` table with `id` (UUID PK), `email` (unique text/varchar), `password_hash` (text), `created_at` (timestamp with timezone). Explicit B-tree index on email.
- Identifiers: UUID v4 generated via native crypto (`crypto.randomUUID()`).
- Error Envelope: `{ "error": { "code": "STRING_CODE", "message": "Human message" } }`. HTTP 409 for duplicate email, 422 for validation error, 401 for unauthorized/invalid credentials.
- Plaintext passwords must never be stored or logged.

## Cross-Story Dependencies

- Story 1.1 established server app builder, pg Pool with safety guardrails, and /health endpoints.
- Story 1.2 establishes `users` schema, password hashing, and user registration `POST /api/auth/register`.
- Story 1.3 builds on Story 1.2 for authentication and JWT issuance.
- Story 1.4 builds on JWT authentication to protect routes and delete accounts.
