


# CCNA StudyLab

A full-stack study platform for the **Cisco CCNA (200-301)** certification exam. Built with Next.js, PostgreSQL, and interactive networking labs to provide a hands-on learning experience.

## Features

- **Study Hub** -- Track progress across all 6 exam domains with 53 objectives and completion checkboxes
- **Flashcards** -- SM-2 spaced repetition algorithm with 200+ cards across all domains, synced to the database when authenticated
- **Practice Exams** -- 2 full 40-question practice exams and focused domain quizzes with scoring and attempt history
- **Study Guides** -- In-depth study guides for all 6 exam domains with objective-level progress tracking
- **Hands-on Labs** -- 8 labs (IOS CLI, subnetting, ACL building, config review, Python) with a CodeMirror editor
- **AI Tutor** -- Claude-powered conversational tutor with domain-specific system prompts and persistent conversation history
- **Progress Persistence** -- All study progress saved to PostgreSQL (flashcards, exams, labs, objectives)
- **Authentication** -- Auth.js v5 with credentials provider and JWT sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS v4, shadcn/ui, CodeMirror 6, Lucide icons |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth 5 beta) |
| AI | Anthropic Claude API |
| Lab Engine | FastAPI (Python) with sandboxed code execution and IOS/subnet/ACL graders |
| Testing | Playwright (E2E), Vitest (unit) |
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
  apps/web/              Next.js frontend + API routes
  content/               Exam blueprint, flashcards, practice exams, labs, study guides
  docker/                Docker Compose and database init scripts
  docs/                  Architecture, API reference, routes, schema docs
  services/lab-engine/   FastAPI lab execution engine with networking graders
  tests/                 Content validation tests
```

## Documentation

- [SETUP.md](./SETUP.md) -- Step-by-step setup guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) -- System architecture and design decisions
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) -- Complete API documentation
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) -- Database schema reference
- [docs/ROUTES.md](./docs/ROUTES.md) -- Frontend route map
- [docs/CONTENT_STRATEGY.md](./docs/CONTENT_STRATEGY.md) -- Content authoring guidelines

## Running Tests

```bash
# Unit tests
cd apps/web && npm test

# E2E tests (starts dev server automatically)
cd apps/web && npm run test:e2e

# Content validation
cd apps/web && npm run test:content

# All tests
cd apps/web && npm run test:all
```

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
