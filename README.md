# CCNA StudyLab

[![CI](https://github.com/E-Conners-Lab/CCNA_Study_Lab/actions/workflows/ci.yml/badge.svg)](https://github.com/E-Conners-Lab/CCNA_Study_Lab/actions/workflows/ci.yml)

A full-stack study platform for the **Cisco CCNA (200-301)** certification exam. Built with Next.js, PostgreSQL, and an interactive IOS CLI simulator for hands-on networking labs.

## Features

- **Study Hub** -- Track progress across all 6 exam domains with 53 objectives and completion checkboxes
- **Flashcards** -- SM-2 spaced repetition algorithm with 201 cards across all domains, synced to the database when authenticated
- **Practice Exams** -- 2 full 40-question sample exams and 6 focused domain quizzes (140 questions total) with scoring and attempt history
- **Study Guides** -- In-depth study guides for all 6 exam domains with objective-level progress tracking
- **Hands-on Labs** -- 10 interactive labs across all 6 domains:
  - 7 IOS CLI labs (VLAN, OSPF, static routing, NAT/PAT, ACLs, EtherChannel, SSH) with a built-in terminal simulator
  - 1 subnetting lab with an interactive calculator
  - 2 Python labs for Domain 6 (REST API/JSON parsing, configuration management)
- **IOS CLI Simulator** -- Realistic Cisco IOS terminal with:
  - Command abbreviation/shorthand support (`conf t`, `sh ip int br`, `int Gi0/0`)
  - Simulated `show` command output for verification without revealing solutions
  - Multi-device labs with device switcher (e.g., SW1/SW2, R1/R2)
  - Automatic grading against solution configs
- **AI Tutor** -- Claude-powered conversational tutor with domain-specific system prompts and persistent conversation history
- **Progress Persistence** -- All study progress saved to PostgreSQL (flashcards, exams, labs, objectives)

## Security

- **Authentication** -- Auth.js v5 with credentials provider, JWT sessions, email verification, and password reset
- **API Protection** -- All API routes require authentication (middleware-enforced); auth routes are public
- **Rate Limiting** -- In-memory sliding-window rate limiting on login (5/min), signup (5/min), chat (20/min), lab execution (30/min), and password reset (3/min)
- **Security Headers** -- HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, strict Referrer-Policy, Permissions-Policy
- **Audit Logging** -- Structured JSON audit logs for login (success/fail), signup, and password reset events
- **Token Security** -- JWT sessions with 8-hour expiry; verification and reset tokens are SHA-256 hashed before database storage
- **Lab Engine Auth** -- FastAPI lab engine requires Bearer token authentication via `LAB_ENGINE_API_KEY`
- **Code Execution** -- Python code execution is isolated to the Docker lab engine (no local subprocess execution)
- **SMTP TLS** -- Enforced on all email connections

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Frontend | Next.js 16, React 19, TailwindCSS v4, shadcn/ui, CodeMirror 6, Lucide icons |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth 5 beta) |
| AI | Anthropic Claude API |
| Lab Engine | FastAPI (Python) with API key auth and IOS/subnet/ACL/config graders |
| Testing | Playwright (E2E), Vitest (unit + content validation), pytest (grader unit tests) |
| Infrastructure | Docker Compose, GitHub Actions CI |

## Quick Start

### Prerequisites

- **Node.js 20+** -- [nodejs.org](https://nodejs.org/) or `brew install node` (macOS)
- **Docker Desktop** -- [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) or `brew install --cask docker` (macOS)

Make sure Docker Desktop is running before step 2.

### Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/E-Conners-Lab/CCNA_Study_Lab.git ccna-studylab
cd ccna-studylab/apps/web
npm install

# 2. Start PostgreSQL
docker compose -f ../../docker/docker-compose.yml up -d postgres

# 3. Configure environment
cp .env.example .env.local

# Generate a secure AUTH_SECRET (required):
openssl rand -base64 32
# Paste the output as the AUTH_SECRET value in .env.local

# (Optional) Add your Anthropic API key to enable the AI Tutor:
# TUTOR_ANTHROPIC_KEY=sk-ant-...

# 4. Set up database and seed content
npx drizzle-kit push
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
        email.ts           Email abstraction (console dev / SMTP prod)
        rate-limit.ts      Sliding-window rate limiter
        sm2.ts             SM-2 spaced repetition algorithm
      __tests__/           Unit and E2E tests
  content/                 JSON content files (seeded into PostgreSQL)
    flashcards/            201 flashcards across 6 domain decks
    practice-exams/        2 sample exams + 6 domain quizzes
    labs/                  10 lab definitions with instructions, solutions, and expected output
    study-guides/          6 domain study guides
  docker/                  Docker Compose and database init scripts
  docs/                    Architecture, API reference, routes, schema docs
  services/lab-engine/     FastAPI lab execution engine with networking graders (93 pytest unit tests)
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
| `AUTH_SECRET` | Yes | Random secret for Auth.js session encryption (`openssl rand -base64 32`) |
| `TUTOR_ANTHROPIC_KEY` | No | Anthropic API key to enable the AI Tutor feature |
| `LAB_ENGINE_URL` | No | Lab engine URL (default: not set; set to `http://localhost:8100/api/v1/grade` for Docker) |
| `LAB_ENGINE_API_KEY` | No | Shared secret for lab engine authentication |
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

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) -- Free to use, modify, and share for non-commercial purposes with attribution.
