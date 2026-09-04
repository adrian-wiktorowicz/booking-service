# Project Guidelines & Agent Instructions

This repository is configured with **Superpowers** and the **BMad Method** to guide AI-driven development.

## Frameworks & Methodology

### 1. Superpowers
- **Discipline & Rigor**: Follow disciplined engineering practices (red/green TDD, systematic debugging, iterative planning).
- **Core Workflow Skills**:
  - `brainstorming`: Explore intent and requirements before creative work.
  - `writing-plans`: Draft clear, bite-sized implementation plans.
  - `test-driven-development`: Write failing tests before implementation code.
  - `systematic-debugging`: Investigate root causes before proposing fixes.
  - `verification-before-completion`: Verify with concrete evidence before marking complete.
- **Location**: `.agents/plugins/superpowers/`

### 2. BMad Method (BMAD-METHOD)
- **Agile AI-Driven Delivery**: Phased planning, architecture, user stories, and execution.
- **Key Skills**:
  - `bmad-help`: Orient workflow position and find next recommended skills.
  - `bmad-build`: Execute agile task builds.
  - `bmad-architecture`: Define system architecture and tech stack decisions.
  - `bmad-create-prd`: Product requirements document generation.
- **Locations**:
  - Skills: `.agents/skills/`
  - Core configurations & modules: `_bmad/`
  - Generated artifacts: `_bmad-output/`


### 3. Caveman
  **Caveman reduces tokens**: just use /caveman every round

### 4. Sub-Agents
  **Parallelization**: use multiple agents for work where paralleliztion is possible i.e simultaneous research, simultaneously implementation, simultaneously code-review, simultaneously testing

### 5. Context7 Pre-Documentation Rule (MANDATORY)
- **Rule**: BEFORE implementing or modifying any code involving external libraries, frameworks, SDKs, or APIs (Fastify, Drizzle ORM, node-postgres, Azure Blob Storage, Vitest, React, etc.), the agent MUST query the **Context7 MCP server** (`resolve-library-id` followed by `query-docs`) to retrieve current official documentation and verified API signatures.
- **Strict Prohibition**: Never guess API parameters, signatures, or methods from training data — verify via Context7 first.

### 6. Ponytail Implementation & Code Review Audit (MANDATORY)
- **Implementation (Ponytail)**:
  - Standard library and native platform features first before external dependencies (e.g. Node 22 native crypto, fetch, AbortSignal, native Canvas).
  - Minimal viable code, zero speculative abstractions, diffs kept strictly under 50 lines.
  - Strict Red-Green TDD (failing test verified before writing production code).
- **Code Review & Auditing**:
  - Every code review (BMad review skills, sub-agent reviews, or manual inspection) MUST explicitly audit against **Ponytail principles**:
    1. Identify and flag over-engineering, dead flexibility, and premature abstractions.
    2. Check if newly introduced code can be replaced with simpler native standard library equivalents.
    3. Verify that tests pass with concrete terminal evidence before approving.