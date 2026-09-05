- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Run integration tests against a live PostgreSQL database for defaultUserRepository and Drizzle migrations
  evidence: Unit and integration tests currently use InMemoryUserRepository doubles because local PostgreSQL was inactive during Story 1.2 development

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Implement layered rate limiting on authentication routes (/api/auth/*)
  evidence: Auth route rate limiting (5 req/min with Retry-After header) is scheduled as an explicit requirement in Story 1.3

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-1-2-user-registration-password-hashing.md`
  summary: Register @fastify/cors restricted to frontend origin
  evidence: NFR7 specifies CORS restricted to frontend origin once frontend integration begins in Epic 2

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-2-2-retrieve-entry-by-date-chronological-paginated-history.md`
  summary: Run integration tests against a live PostgreSQL database for DrizzleJournalRepository findByDate and findMany queries
  evidence: Repository tests currently use InMemoryJournalRepository test doubles while live PostgreSQL integration testing is deferred

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-client-journal-interaction-resilience-shell.md`
  summary: Implement user/tenant scoping for local-first draft storage keys across multiple browser sessions
  evidence: Draft storage currently keys on draft_${date}; multi-user tenant partition is scheduled for Epic 2 Story 2.4

- source_spec: `G:\testowanie\booking-service/_bmad-output/implementation-artifacts/spec-client-journal-interaction-resilience-shell.md`
  summary: Implement client-side cloud entry retrieval and history timeline navigation on calendar date selection
  evidence: Date switching currently initializes from local draft or empty state without fetching GET /api/journal/entries/:date, which is scoped for the upcoming history view story
