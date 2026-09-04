---
title: Product Brief - Daily Mind & Mood Journal (Playground)
status: approved
created: 2026-09-02
updated: 2026-09-02
---

# Product Brief: Daily Mind & Mood Journal (Playground)

## Executive Summary

**Daily Mind & Mood Journal** is a personal journaling and daily reflection web application integrated with an intelligent conversational AI companion. Users log their daily experiences—including activities, forward-looking plans, completed goals, emotional state/mood, and an optional "Photo of the Day" (e.g., meals, encounters, or scenery). The embedded AI agent actively queries and reasons over historical entries to provide empathetic insights, surface behavior/mood trends (such as correlations between outdoor walks and elevated mood), and facilitate reflective self-dialogue.

While designed as an intuitive, secure personal journal, this project serves a dual primary purpose: it is an **engineering playground** built under the **BMad Method**. It serves as a rigorous testing ground for mastering human-in-the-loop AI pair programming, enforcing test-driven development (TDD), exercising architectural governance, and drilling real-world DevOps scenarios (including intentional fault injection, issue triage by autonomous agents, and hotfix/rollback workflows).

## The Problem & The Purpose

### The User Problem
Modern life makes self-reflection and tracking well-being difficult without cumbersome tools. Standard journaling apps are passive write-only silos; they collect text that users rarely revisit and fail to help users detect subtle lifestyle trends (e.g., how daily habits, tasks, or walks impact their psychological state).

### The Engineering & Learning Problem
Many engineers risk falling into "vibe coding"—passively delegating complex tasks to generative AI without verifying code, understanding architecture, or maintaining control over defects. To build true confidence in AI-augmented software delivery, engineers need a bounded, end-to-end full-stack application (frontend, backend, database, cloud storage, authentication, and LLM orchestration) where every pull request is reviewed, every feature is test-driven, and failure scenarios can be safely simulated and resolved.

## The Solution

A lightweight, highly responsive single-user-first (multi-tenant capable) journal platform consisting of:
1. **Daily Log Engine:** Fast entry capture featuring:
   - Rich/markdown text (activities, notes, thoughts).
   - Task & plan tracking (what was accomplished, what is planned).
   - Mood rating / emotional tags (e.g., 1-5 scale + mood tags like `peaceful`, `stressed`, `energized`).
   - "Photo of the Day" attachment (compressed & securely uploaded to cloud object storage).
2. **AI Reflection & Trend Companion:** A contextual chat interface where the AI agent acts as a reflective thinking partner.
   - Summarizes past weeks/months.
   - Detects patterns: *"You've noted feeling higher energy on days following evening walks in nature."*
   - Answers natural language questions across stored memories: *"When was the last time I cooked Thai food, and how did I feel that day?"*
3. **Resilient Full-Stack Architecture:**
   - Single Page / Modern Web Frontend.
   - REST or RPC Backend API.
   - Relational/Document Database on Azure.
   - Azure Blob Storage for media assets.
   - Stateless JWT / Session-based User Authentication & Authorization.

## What Makes This Different

- **Active Reflection, Not Just Archive:** Converts passive historical data into proactive insights via grounded AI analysis.
- **Architected as a Controlled Laboratory:** Built specifically with modular boundaries to support intentional defect induction (e.g., DB connection pool exhaustion, schema migration breaking changes, media upload payload overflows, expired LLM context errors) to practice incident recovery, automated triage, and git rollback.
- **Radical Simplicity & Traceability:** Zero speculative abstractions; every component has clear unit/integration tests and verifiable invariants.

## Who This Serves

- **Primary End User (Adria):** Desires a private, aesthetic space to jot down daily highlights, log photos, track emotional trajectory, and converse with an AI partner about personal growth.
- **Primary Engineer (Adria as Tech Lead):** Seeks to master the BMad methodology, inspect and critique AI-authored code, validate test coverage, and rehearse GitHub branching, issue-driven debugging, and deployment rollbacks.

## Success Criteria

### Functional / User Success
- [ ] User can authenticate, securely create/edit daily entries, and view past history by date.
- [ ] User can upload a daily photo with instant thumbnailing and secure storage.
- [ ] User can engage in a multi-turn chat with the AI agent that accurately quotes or references past entries without hallucinations.
- [ ] Data privacy is absolute: entries are strictly isolated to the authenticated user.

### Engineering & Methodology Success (BMad Gates)
- [ ] **100% Verified TDD:** All backend services, data access layers, and auth middlewares are written against failing tests before implementation.
- [ ] **Strict Code Review:** Every AI-generated commit is reviewed, analyzed, and approved with zero "blind merges".
- [ ] **Fault Injection Drill Passed:**
  1. A breaking change is deliberately merged to the main branch.
  2. The failure is identified via automated tests or health checks.
  3. Fast rollback / revert is successfully executed.
  4. An AI agent is directed to diagnose the root cause via issue logs, produce a regression test, and submit a clean fix.

## Scope & Boundaries

### In Scope (MVP)
- **Direct Azure Infrastructure (Human-Approved CLI):** Infrastructure setup (Resource Group, Azure Database for PostgreSQL or Azure SQL, Azure Blob Storage) drafted via idempotent, transparent `az cli` scripts. Scripts are explicitly reviewed and executed by the user to maintain complete control.
- **Auth:** Email/password registration, login, protected API routes, user context. Native email/password auth with hashed passwords in DB and JWT tokens.
- **Journal CRUD:** Create, Read, Update, Delete for journal entries tied to a specific calendar date.
- **Media Upload:** Single "Photo of the Day" per entry stored in Azure Blob Storage via signed URLs or backend stream.
- **Deterministic Analytics + AI Reflection:** 
  1. *Deterministic Layer:* Backend aggregates and computes concrete metrics (e.g. correlation between mood and tagged activities like walking). 100% unit-testable.
  2. *LLM Presentation Layer:* Clean prompt passing computed metrics to the LLM to format empathetic insights and answer conversational queries.
- **Frontend Dashboard:** Minimal, responsive web UI (native HTML `<input type="date">` and browser APIs over heavy component libraries).
- **Engineering Discipline (Ponytail & BMad):** Zero unrequested abstractions, stdlib/native platform features first, diffs kept under 50 lines, full TDD coverage.

### Out of Scope (Deferred)
- Multi-image galleries per day (strictly 1 image/day in MVP).
- Social sharing or public posts (strictly private journal).
- Complex vector database / RAG infrastructure (deterministic DB queries + filtered prompt injection).
- Heavy external UI component libraries (native browser controls preferred).


## Vision (Next Horizons)
If expanded, the platform could incorporate voice-memo transcription, automated weekly digest emails, and multi-modal image understanding (AI describing what it sees in the day's photo to connect with the journal text).
