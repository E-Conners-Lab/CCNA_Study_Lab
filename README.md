# CCNA StudyLab

[![CI](https://github.com/elliotconner/ccna-studylab/actions/workflows/ci.yml/badge.svg)](https://github.com/elliotconner/ccna-studylab/actions/workflows/ci.yml)

A full-stack study platform for the **Cisco CCNA (200-301)** certification exam. Built with Next.js, PostgreSQL, and an interactive IOS CLI simulator for hands-on networking labs.

## Features

- **Study Hub** -- Track progress across all 6 exam domains with 53 objectives and completion checkboxes
- **Flashcards** -- SM-2 spaced repetition algorithm with 201 cards across all domains, synced to the database when authenticated
- **Practice Exams** -- 2 full 40-question sample exams and 6 focused domain quizzes (140 questions total) with scoring and attempt history
- **Study Guides** -- In-depth study guides for all 6 exam domains with objective-level progress tracking
- **Hands-on Labs** -- 8 interactive labs:
  - 7 IOS CLI labs (VLAN, OSPF, static routing, NAT/PAT, ACLs, EtherChannel, SSH) with a built-in terminal simulator
  - 1 subnetting lab with an interactive calculator
- **IOS CLI Simulator** -- Realistic Cisco IOS terminal with:
  - Command abbreviation/shorthand support (`conf t`, `sh ip int br`, `int Gi0/0`)
  - Simulated `show` command output for verification without revealing solutions
  - Multi-device labs with device switcher (e.g., SW1/SW2, R1/R2)
  - Automatic grading against solution configs
- **AI Tutor** -- Claude-powered conversational tutor with domain-specific system prompts and persistent conversation history
- **Progress Persistence** -- All study progress saved to PostgreSQL (flashcards, exams, labs, objectives)
- **Authentication** -- Auth.js v5 with credentials provider, JWT sessions, email verification, and password reset
- **Rate Limiting** -- In-memory sliding-window rate limiting on signup, chat, and lab execution endpoints
- **Sandbox Safety** -- Python lab submissions are screened for dangerous imports before execution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS v4, shadcn/ui, CodeMirror 6, Lucide icons |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth 5 beta) |
| AI | Anthropic Claude API |
| Lab Engine | FastAPI (Python) with sandboxed code execution and IOS/subnet/ACL graders |
| Testing | Playwright (E2E), Vitest (unit + content validation) |
| Infrastructure | Docker Compose |

## Quick Start

> **macOS**: Install Docker Desktop first (`brew install --cask docker`) and make sure it's running before step 2.

```bash
# 1. Clone and install
git clone <your-repo-url> ccna-studylab
cd ccna-studylab
npm install
cd apps/web && npm install && cd ../..

# 2. Start PostgreSQL (Docker Desktop must be running)
docker compose -f docker/docker-compose.yml up -d postgres

# 3. Configure environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local: generate AUTH_SECRET and optionally add
# TUTOR_ANTHROPIC_KEY with your API key to enable the AI Tutor

# 4. Run migrations and seed data
cd apps/web
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `student@ccna.lab` / `ccna123`.

See [SETUP.md](./SETUP.md) for the full setup guide.

## Project Structure

```
ccna-studylab/
  apps/web/                Next.js frontend + API routes
    src/
      app/                 App Router pages and API routes
      components/          React components (UI, labs, dashboard)
        labs/              IOS terminal simulator, validators, lab components
      lib/
        data/              Data access layer (exams, flashcards, labs, study, tutor)
        db/                Drizzle ORM schema and migrations
        auth.ts            Auth.js v5 configuration
        flashcards.ts      SM-2 spaced repetition algorithm
      __tests__/           Unit and E2E tests
  content/                 JSON content files (seeded into PostgreSQL)
    flashcards/            201 flashcards across 6 domain decks
    practice-exams/        2 sample exams + 6 domain quizzes
    labs/                  8 lab definitions with instructions, solutions, and expected output
    study-guides/          6 domain study guides
  docker/                  Docker Compose and database init scripts
  docs/                    Architecture, API reference, routes, schema docs
  services/lab-engine/     FastAPI lab execution engine with networking graders
  tests/                   Content validation tests
```

## Available Commands

All commands run from `apps/web/`:

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint

# Database (requires PostgreSQL running via Docker)
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:seed          # Seed content into database
npm run db:studio        # Open Drizzle Studio (database GUI)

# Testing
npm test                 # Unit tests (Vitest)
npm run test:watch       # Unit tests in watch mode
npm run test:e2e         # E2E tests (Playwright, starts dev server)
npm run test:content     # Content validation (validates JSON in content/)
npm run test:all         # Unit + content validation
```

## Environment Variables

Configure in `apps/web/.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (default: `postgresql://studylab:studylab_dev_2024@localhost:5433/ccna_studylab`) |
| `AUTH_SECRET` | Yes | Random secret for Auth.js session encryption |
| `TUTOR_ANTHROPIC_KEY` | No | Anthropic API key to enable the AI Tutor feature |
| `SMTP_HOST` | No | SMTP server host for sending emails (e.g., `smtp.resend.com`) |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username/API key |
| `SMTP_PASS` | No | SMTP password |
| `EMAIL_FROM` | No | Sender email address (default: `CCNA StudyLab <noreply@example.com>`) |

> The Anthropic key is intentionally named `TUTOR_ANTHROPIC_KEY` (not `ANTHROPIC_API_KEY`) to avoid conflicts with other tools.
> Without SMTP configured, verification and password reset emails are logged to the console (dev mode).

## Documentation

- [SETUP.md](./SETUP.md) -- Step-by-step setup guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) -- System architecture and design decisions
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) -- Complete API documentation
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) -- Database schema reference
- [docs/ROUTES.md](./docs/ROUTES.md) -- Frontend route map
- [docs/CONTENT_STRATEGY.md](./docs/CONTENT_STRATEGY.md) -- Content authoring guidelines

## Exam Domains (CCNA 200-301)

| # | Domain | Weight |
|---|--------|--------|
| 1 | Network Fundamentals | 20% |
| 2 | Network Access | 20% |
| 3 | IP Connectivity | 25% |
| 4 | IP Services | 10% |
| 5 | Security Fundamentals | 15% |
| 6 | Automation and Programmability | 10% |

## License

ISC
