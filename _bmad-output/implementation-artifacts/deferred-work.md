- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Run integration tests against a live PostgreSQL database for defaultUserRepository and Drizzle migrations
  evidence: Unit and integration tests currently use InMemoryUserRepository doubles because local PostgreSQL was inactive during Story 1.2 development

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Implement layered rate limiting on authentication routes (/api/auth/*)
  evidence: Auth route rate limiting (5 req/min with Retry-After header) is scheduled as an explicit requirement in Story 1.3

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Register @fastify/cors restricted to frontend origin
  evidence: NFR7 specifies CORS restricted to frontend origin once frontend integration begins in Epic 2
