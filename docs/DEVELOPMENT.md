# CCNA StudyLab -- Development Guide

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

Developer workflow reference for the CCNA StudyLab project. Covers service startup, available scripts, database management, debugging, code conventions, and testing.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [NPM Scripts](#npm-scripts)
3. [Running Modes](#running-modes)
4. [Database Management](#database-management)
5. [Hot Reload](#hot-reload)
6. [Debugging Tips](#debugging-tips)
7. [Code Conventions](#code-conventions)
8. [Adding New Content](#adding-new-content)
9. [Testing Workflows](#testing-workflows)

---

## Quick Start

Start services in this order:

```bash
# 1. Start Docker services (PostgreSQL + Lab Engine)
docker compose -f docker/docker-compose.yml up -d

# 2. Wait for PostgreSQL health check to pass
docker compose -f docker/docker-compose.yml ps

# 3. Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local: set AUTH_SECRET (generate with: openssl rand -base64 32)

# 4. Install dependencies
cd apps/web
npm install

# 5. Set up the database schema and seed data
npm run db:generate
npm run db:migrate
npm run db:seed

# 6. Start the development server
npm run dev
```

The app is available at `http://localhost:3000`. Log in with:

| Field | Value |
|-------|-------|
| Email | `student@ccna.lab` |
| Password | `ccna123` |

---

## NPM Scripts

All scripts are run from the `apps/web` directory.

### Application

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start the development server with Turbopack |
| `build` | `next build` | Create a production build |
| `start` | `next start` | Start the production server |
| `lint` | `eslint` | Run ESLint on the codebase |

### Testing

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `vitest run` | Run unit tests once |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run unit tests with v8 coverage |
| `test:e2e` | `playwright test` | Run end-to-end tests |
| `test:content` | `vitest run --config ../../tests/content-validation/vitest.config.ts` | Validate content JSON files |
| `test:all` | `vitest run && vitest run --config ...` | Run unit tests + content validation |

### Database

| Script | Command | Description |
|--------|---------|-------------|
| `db:generate` | `drizzle-kit generate` | Generate migration files from schema changes |
| `db:migrate` | `drizzle-kit migrate` | Apply pending migrations to the database |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio (visual database browser) |
| `db:seed` | `tsx scripts/seed-db.ts` | Seed the database from content JSON files |

### Documentation

| Script | Command | Description |
|--------|---------|-------------|
| `docs:generate` | `tsx ../../scripts/generate-docs.ts` | Generate documentation from source |
| `docs:validate` | `tsx ../../scripts/validate-docs.ts` | Validate documentation completeness |

---

## Running Modes

### Full-Stack Mode (default)

All features enabled. Requires PostgreSQL and environment variables.

```bash
docker compose -f docker/docker-compose.yml up -d
cd apps/web && npm run dev
```

Features: authentication, progress tracking, flashcard scheduling (SM-2), exam attempt history, AI Tutor conversations.

### File-Only Mode

Runs without a database. Content loads from JSON files under `content/`. Progress is not persisted.

```bash
cd apps/web
# Do NOT set DATABASE_URL in .env.local
npm run dev
```

When `DATABASE_URL` is not set:
- The middleware skips authentication (same as `SKIP_AUTH=true`).
- API routes fall back to reading JSON files directly.
- Progress, flashcard scheduling, and exam history are not saved.

This mode is useful for content development and UI work.

### With Lab Engine

Enables code execution for all lab types (IOS CLI, subnetting, config review, Python, ACL builder).

```bash
docker compose -f docker/docker-compose.yml up -d
# Add to apps/web/.env.local:
# LAB_ENGINE_URL=http://localhost:8100
cd apps/web && npm run dev
```

Without the lab engine, only Python labs support local execution via a `python3` subprocess.

---

## Database Management

### Drizzle Studio

Visual database browser for inspecting and editing data:

```bash
cd apps/web
npm run db:studio
```

Opens at `https://local.drizzle.studio`. Allows you to browse tables, run queries, and edit rows.

### Schema Changes

1. Edit the schema in `apps/web/src/lib/db/schema.ts`.
2. Generate a migration:
   ```bash
   npm run db:generate
   ```
3. Apply the migration:
   ```bash
   npm run db:migrate
   ```

### Seeding

The seed script (`apps/web/scripts/seed-db.ts`) is idempotent. It clears content tables (domains, objectives, flashcards, practice questions, labs) before re-inserting from JSON files. The default user (`student@ccna.lab`) is only inserted if it does not already exist.

```bash
cd apps/web
npm run db:seed
```

### Full Reset

Destroy all data and start fresh:

```bash
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d postgres
# Wait for health check
cd apps/web
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Connection Details

| Property | Development Value |
|----------|-------------------|
| Host | `localhost` |
| Port | `5433` (mapped from container 5432) |
| Database | `ccna_studylab` |
| User | `studylab` |
| Password | `studylab_dev_2024` |
| Container name | `ccna-studylab-db` |

Connect directly:
```bash
docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab
```

---

## Hot Reload

### Next.js (Turbopack)

The development server uses Turbopack for fast module replacement. Changes to `.ts`, `.tsx`, `.css`, and other source files are reflected in the browser without a full page reload.

If HMR stops working, check the terminal for compilation errors and restart with `npm run dev`.

### Lab Engine (FastAPI)

The Docker Compose volume mount maps `services/lab-engine/` into the container:

```yaml
volumes:
  - ../services/lab-engine:/app
```

Changes to Python files are picked up automatically by FastAPI's reload mechanism. No container rebuild is needed for code changes. Rebuild only when `requirements.txt` changes:

```bash
docker compose -f docker/docker-compose.yml build lab-engine
docker compose -f docker/docker-compose.yml up -d lab-engine
```

---

## Debugging Tips

### Inspect API Routes

Use `curl` to test API routes directly:

```bash
# Dashboard stats
curl http://localhost:3000/api/dashboard/stats

# List flashcards
curl http://localhost:3000/api/flashcards

# List labs
curl http://localhost:3000/api/labs

# Lab engine health
curl http://localhost:8100/health

# Grade a lab submission
curl -X POST http://localhost:8100/api/v1/grade \
  -H "Content-Type: application/json" \
  -d '{"exercise_id":"test","code":"print(42)","lab_type":"python"}'
```

### Check Database State

```bash
# List all tables
docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab \
  -c "\dt"

# Count rows in key tables
docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab \
  -c "SELECT 'domains' as t, count(*) FROM domains UNION ALL SELECT 'flashcards', count(*) FROM flashcards UNION ALL SELECT 'practice_questions', count(*) FROM practice_questions UNION ALL SELECT 'labs', count(*) FROM labs UNION ALL SELECT 'users', count(*) FROM users;"

# Check the seed user
docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab \
  -c "SELECT id, name, email FROM users;"
```

### Inspect Auth Cookies

In the browser DevTools:
1. Open the **Application** tab (Chrome) or **Storage** tab (Firefox).
2. Under **Cookies**, select `http://localhost:3000`.
3. Look for `authjs.session-token` (development) or `__Secure-authjs.session-token` (production HTTPS).
4. The cookie value is a JWT. Decode it at [jwt.io](https://jwt.io) to inspect the payload.

### Common Log Locations

| Service | How to view logs |
|---------|-----------------|
| Next.js | Terminal running `npm run dev` |
| PostgreSQL | `docker logs ccna-studylab-db` |
| Lab Engine | `docker logs ccna-studylab-labs` |

---

## Code Conventions

### TypeScript

- Strict mode enabled.
- Path alias `@/` maps to `apps/web/src/`. Use `@/lib/db`, `@/components/ui`, etc.
- Prefer named exports over default exports (except for Next.js pages).

### Component Patterns

- **Server Components** for pages that fetch data and do not need interactivity.
- **Client Components** (`"use client"`) for pages with interactivity, state, or browser APIs.
- UI primitives are in `src/components/ui/` (Radix UI + shadcn/ui pattern).
- Feature components are co-located with their pages or in `src/components/`.

### Styling

- Tailwind CSS v4 with `@tailwindcss/postcss`.
- `clsx` + `tailwind-merge` for conditional class names (via the `cn()` utility).
- No CSS modules or styled-components.

### Database

- Drizzle ORM with the `postgres` driver.
- Schema defined in `src/lib/db/schema.ts`.
- Lazy connection via `getDb()` — the database connection is created on first use, not at import time.
- Use `isDbConfigured()` for fast feature-flag checks without creating a connection.

### API Routes

- Next.js App Router route handlers in `src/app/api/`.
- Return `NextResponse.json()` with appropriate status codes.
- API routes with database access use `getDb()` and handle the case where the database is not configured.

---

## Adding New Content

### Flashcards

1. Create or edit a file in `content/flashcards/domain-N.json`.
2. Follow this schema for each flashcard:
   ```json
   {
     "id": "fc-N.X-XX",
     "objectiveCode": "N.X",
     "question": "Question text",
     "answer": "Answer text",
     "explanation": "Detailed explanation",
     "sourceUrl": "https://...",
     "difficulty": "easy|medium|hard",
     "tags": ["tag1", "tag2"]
   }
   ```
3. The `objectiveCode` must match a code in `content/exam-blueprint.json`.
4. Run validation: `npm run test:content --prefix apps/web`
5. Re-seed the database: `npm run db:seed --prefix apps/web`

### Practice Exam Questions

1. Create or edit a file in `content/practice-exams/`.
2. Follow this schema for each question:
   ```json
   {
     "id": "q-exam-XX",
     "objectiveCode": "N.X",
     "type": "multiple_choice|multiple_select|drag_drop|fill_blank",
     "question": "Question text",
     "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
     "correctAnswer": "A",
     "explanation": "Why this answer is correct",
     "sourceUrl": "https://...",
     "difficulty": "easy|medium|hard",
     "tags": ["tag1"]
   }
   ```
3. Multiple choice must have exactly 4 options. Multiple select must have at least 4 options with at least 2 correct answers (array).
4. Run validation: `npm run test:content --prefix apps/web`

### Labs

1. Create a JSON file in `content/labs/`.
2. Valid lab types: `ios-cli`, `subnetting`, `config-review`, `python`, `acl-builder`.
3. Required fields: `slug`, `title`, `description`, `domain`, `domainSlug`, `objectiveCode`, `difficulty`, `estimatedMinutes`, `type`, `tags`, `learningObjectives`, `instructions`, `starterCode`, `solutionCode`, `expectedOutput`, `hints`.
4. Re-seed the database after adding: `npm run db:seed --prefix apps/web`

### Study Guides

Study guide JSON files are in `content/study-guides/`. Each file corresponds to a domain slug and is loaded by the `GET /api/study/{slug}` route.

---

## Testing Workflows

### Unit Tests

```bash
cd apps/web

# Run once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

Tests use Vitest with jsdom environment and `@testing-library/react`. The `@/` path alias is configured in `vitest.config.ts`.

### E2E Tests

```bash
cd apps/web

# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run tests
npm run test:e2e
```

Playwright is configured to start its own dev server with `SKIP_AUTH=true`. Tests run against `http://localhost:3000` in Chromium.

### Content Validation

```bash
cd apps/web
npm run test:content
```

Validates all JSON content files in `content/` against the exam blueprint. See [TESTING.md](./TESTING.md) for details.

### Run Everything

```bash
cd apps/web
npm run test:all    # Unit tests + content validation
npm run test:e2e    # E2E tests (separate)
```

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture and design decisions
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) -- All environment variables
- [ROUTES.md](./ROUTES.md) -- Frontend routes and API reference
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) -- Common issues and solutions
- [TESTING.md](./TESTING.md) -- Testing stack reference
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) -- Database schema documentation
