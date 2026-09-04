# Addendum: Daily Mind & Mood Journal (Playground)

## Engineering & DevOps Drill Scenarios

This document preserves the specialized learning and testing drills defined by the user for subsequent BMad phases (Architecture with Winston, Stories with John, Implementation with Amelia).

### Drill Scenario 1: Deliberate Fault Injection & Agent Recovery
- **Action:** Push and merge a breaking defect directly into `main` (or via a fast-tracked PR).
  - *Example candidate bugs:* 
    - Unhandled exception when a journal entry has no mood or photo attached.
    - Bad DB migration / column renaming without updating ORM models.
    - Missing environment variable crash on startup.
- **Workflow Exercise:**
  1. User creates a GitHub Issue describing the crash / incident symptoms.
  2. Subagent or pair programmer is summoned to run systematic debugging.
  3. Verify whether the agent reproduces the failure via a test before writing a fix.
  4. Measure latency, accuracy, and whether the agent attempts any unapproved side-refactorings.

### Drill Scenario 2: Emergency Manual Rollback Drill
- **Action:** Simulate production outage where time-to-recovery is critical.
- **Workflow Exercise:**
  1. Practice executing `git revert` or rolling back deployment in Azure App Service / Container Apps.
  2. Verify system restoration before investigating the underlying issue.

### Technical Stack Candidates for Winston (Architect)
- **Frontend:** React + Vite + Tailwind CSS (using native HTML controls like `<input type="date">` where feasible).
- **Backend:** Node.js (Fastify/Express with TypeScript) or Python (FastAPI).
- **Database:** Azure Database for PostgreSQL (Flexible Server) or Azure SQL Database.
- **Object Storage:** Azure Blob Storage for photo attachments.
- **LLM Integration:** OpenAI API or Azure OpenAI Service with structured prompt templates.

## Anti-Vibe-Coding Tooling Stack & Operating Rules

1. **BMad Method:** Structured lifecycle gating: Analysis (Mary) -> Architecture (Winston) -> Stories (John) -> Implementation (Amelia) -> Code Review -> DevOps Drills.
2. **Ponytail (Code Minimalism):** The ladder of simplicity enforced. Native platform & stdlib first, zero unrequested abstractions, small diffs (<50 lines).
3. **Context7 (Live Docs):** Mandatory lookup for Azure CLI, Azure SDKs, and framework APIs before proposing implementation. Zero guessing from stale training data.
4. **Context-Mode (Context Hygiene):** Sandbox command execution and log filtering via `ctx_execute_file` / `ctx_batch_execute` to keep session context pristine.
5. **Caveman (Terse Communication):** Active during dev & debug loops. Eliminates filler words, focuses strictly on `[thing] [action] [reason]. [next step].`

