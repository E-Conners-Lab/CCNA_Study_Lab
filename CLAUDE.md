# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

All commands run from `apps/web/` unless noted:

```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint

# Database (requires PostgreSQL running via Docker)
docker compose -f docker/docker-compose.yml up -d postgres  # Start DB (port 5433)
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:seed          # Seed with sample data (scripts/seed-db.ts)
npm run db:studio        # Open Drizzle Studio

# Tests
npm test                 # Unit tests (Vitest)
npm run test:watch       # Unit tests in watch mode
npm run test:e2e         # E2E tests (Playwright, needs DB + seed)
npm run test:content     # Content validation (validates JSON in content/)
npm run test:all         # Unit + content validation
```

To run a single test: `npx vitest run path/to/test.ts` from `apps/web/`.

## Architecture

**Monorepo with two services:**

1. **Next.js web app** (`apps/web/`) — Frontend + API routes. All dashboard pages are client components (`"use client"`). Uses App Router with `src/` directory.
2. **FastAPI lab engine** (`services/lab-engine/`) — Python service (port 8100) for grading labs. Has specialized graders: `ios_grader.py`, `subnet_grader.py`, `config_grader.py`, `acl_grader.py`.

**Key paths in `apps/web/src/`:**
- `lib/db/schema.ts` — Drizzle ORM schema (16 tables: auth, content, progress, labs, tutor)
- `lib/auth.ts` — Auth.js v5 config (credentials provider, JWT sessions)
- `lib/data/` — Data access layer (one file per feature: exams, flashcards, labs, study, tutor, dashboard, progress)
- `lib/flashcards.ts` — SM-2 spaced repetition algorithm
- `app/api/` — API routes (auth, chat, dashboard, exams, flashcards, labs, study, tutor)
- `components/ui/` — shadcn/ui primitives

**Content lives in `content/`** as JSON files: flashcards, practice exams, labs, study guides, and the exam blueprint. These are seeded into PostgreSQL via `db:seed`.

**Environment:** Config goes in `apps/web/.env.local`. Key vars: `DATABASE_URL`, `AUTH_SECRET`, `TUTOR_ANTHROPIC_KEY`. The Anthropic key is intentionally named `TUTOR_ANTHROPIC_KEY` (not `ANTHROPIC_API_KEY`) to avoid conflicts with the Claude Code CLI.

**Docker:** `docker/docker-compose.yml` runs PostgreSQL (port 5433, db `ccna_studylab`, user `studylab`) and optionally the lab engine (port 8100).

**Auth:** Default dev credentials are `student@ccna.lab` / `ccna123`.
