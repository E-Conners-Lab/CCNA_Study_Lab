# CCNA StudyLab -- Troubleshooting Guide

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

Common issues and solutions for the CCNA StudyLab project. Each entry follows a **Symptom / Cause / Solution** format.

---

## Table of Contents

1. [Database Issues](#database-issues)
   - [Database does not exist](#database-does-not-exist)
   - [Port 5433 already in use](#port-5433-already-in-use)
   - [Migration errors](#migration-errors)
   - [Seed failures](#seed-failures)
   - [DATABASE_URL not set](#database_url-not-set)
2. [Authentication Issues](#authentication-issues)
   - [AUTH_SECRET not set](#auth_secret-not-set)
   - [Auth redirect loop](#auth-redirect-loop)
   - [Session cookie problems](#session-cookie-problems)
   - [Email already in use](#email-already-in-use)
3. [Lab Engine Issues](#lab-engine-issues)
   - [Unhealthy container](#unhealthy-container)
   - [Port 8100 unreachable](#port-8100-unreachable)
   - [CORS errors](#cors-errors)
   - [Unknown lab type](#unknown-lab-type)
4. [Testing Issues](#testing-issues)
   - [E2E login redirect](#e2e-login-redirect)
   - [Content validation failures](#content-validation-failures)
   - [Playwright timeout](#playwright-timeout)
5. [Development Issues](#development-issues)
   - [Hot reload not working](#hot-reload-not-working)
   - [Node version incompatibility](#node-version-incompatibility)
   - [Docker Desktop not running](#docker-desktop-not-running)
   - [AI Tutor API key not configured](#ai-tutor-api-key-not-configured)

---

## Database Issues

### Database does not exist

**Symptom:**
```
error: database "ccna_studylab" does not exist
```

**Cause:** The PostgreSQL container is running but the database has not been created. This happens when the container starts for the first time without the init script, or when the volume was cleared.

**Solution:**

1. Ensure the Docker init script exists at `docker/postgres/init.sql`.
2. Recreate the container so the init script runs:
   ```bash
   docker compose -f docker/docker-compose.yml down -v
   docker compose -f docker/docker-compose.yml up -d postgres
   ```
3. Wait for the health check to pass:
   ```bash
   docker compose -f docker/docker-compose.yml ps
   ```
4. Push the schema and seed data:
   ```bash
   cd apps/web
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

If you cannot recreate the container, create the database manually:
```bash
docker exec -it ccna-studylab-db psql -U studylab -c "CREATE DATABASE ccna_studylab;"
```

---

### Port 5433 already in use

**Symptom:**
```
Bind for 0.0.0.0:5433 failed: port is already allocated
```

**Cause:** Another process or a previous container is bound to host port 5433. The Docker Compose file maps container port 5432 to host port 5433 to avoid conflicts with a system-level PostgreSQL installation.

**Solution:**

1. Find the process using port 5433:
   ```bash
   lsof -i :5433
   ```
2. Stop the conflicting process, or stop and remove the old container:
   ```bash
   docker compose -f docker/docker-compose.yml down
   docker compose -f docker/docker-compose.yml up -d postgres
   ```
3. If another service genuinely needs port 5433, change the port mapping in `docker/docker-compose.yml`:
   ```yaml
   ports:
     - "5434:5432"  # Use a different host port
   ```
   Then update `DATABASE_URL` in `apps/web/.env.local` to match:
   ```
   DATABASE_URL=postgresql://studylab:studylab_dev_2024@localhost:5434/ccna_studylab
   ```

---

### Migration errors

**Symptom:**
```
error: relation "users" already exists
```
or
```
error: column "xyz" of relation "users" does not exist
```

**Cause:** The database schema is out of sync with the Drizzle migration files. This can happen after pulling new changes that include schema modifications, or after manually altering the database.

**Solution:**

1. If the database is in development and can be reset:
   ```bash
   docker compose -f docker/docker-compose.yml down -v
   docker compose -f docker/docker-compose.yml up -d postgres
   # Wait for health check
   cd apps/web
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

2. If you need to preserve data, generate fresh migrations and apply them:
   ```bash
   cd apps/web
   npm run db:generate
   npm run db:migrate
   ```

---

### Seed failures

**Symptom:**
```
ERROR: Seeding failed: relation "domains" does not exist
```

**Cause:** The `db:seed` script was run before running migrations. The seed script requires the schema tables to exist.

**Solution:**

Run the full setup sequence in order:
```bash
cd apps/web
npm run db:generate
npm run db:migrate
npm run db:seed
```

If seeding fails with an objective code warning like:
```
⚠ No objective found for code "1.8" in domain-1.json, skipping
```
This is non-fatal. It means a flashcard references an objective code that does not exist in `content/exam-blueprint.json`. Verify that the blueprint and content files are in sync.

---

### DATABASE_URL not set

**Symptom:**
```
DATABASE_URL environment variable is not set.
Start PostgreSQL with: docker compose -f docker/docker-compose.yml up -d postgres
```

**Cause:** The `DATABASE_URL` environment variable is not configured. The application requires it for any database-backed feature (authentication, progress tracking, flashcard scheduling).

**Solution:**

1. Copy the example environment file:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

2. Verify the variable is set:
   ```bash
   grep DATABASE_URL apps/web/.env.local
   ```
   Expected:
   ```
   DATABASE_URL=postgresql://studylab:studylab_dev_2024@localhost:5433/ccna_studylab
   ```

3. Start the database:
   ```bash
   docker compose -f docker/docker-compose.yml up -d postgres
   ```

**Note:** The application can run without `DATABASE_URL` in file-only mode. Content loads from JSON files, but progress is not persisted and authentication is disabled.

---

## Authentication Issues

### AUTH_SECRET not set

**Symptom:**
```
AUTH_SECRET environment variable is not set. Generate one with: openssl rand -base64 32
```

The application crashes on startup with this error.

**Cause:** Auth.js v5 requires `AUTH_SECRET` for JWT session signing. The check in `src/lib/auth.ts` throws immediately if the variable is missing.

**Solution:**

1. Generate a secret:
   ```bash
   openssl rand -base64 32
   ```

2. Add it to `apps/web/.env.local`:
   ```
   AUTH_SECRET=<paste-generated-value-here>
   ```

3. Restart the development server.

---

### Auth redirect loop

**Symptom:** The browser cycles between `/dashboard` and `/login` repeatedly, never loading either page. The network tab shows a chain of `308` redirects.

**Cause:** The middleware at `src/middleware.ts` redirects unauthenticated users to `/login`, but the login page or its client-side logic redirects back to `/dashboard`. This typically happens when:

- `AUTH_SECRET` is set but the database is down (cannot verify credentials).
- The session cookie exists but is signed with a different `AUTH_SECRET` than the current one.

**Solution:**

1. Clear cookies for `localhost:3000` in your browser.
2. Verify the database is running:
   ```bash
   docker compose -f docker/docker-compose.yml ps
   ```
3. Verify `AUTH_SECRET` has not changed since the session was created.
4. If the database is unavailable and you want to bypass auth:
   ```bash
   # Add to apps/web/.env.local
   SKIP_AUTH=true
   ```
5. Restart the development server.

---

### Session cookie problems

**Symptom:** Authentication succeeds (login form submits without error), but the user is immediately redirected back to `/login` on the next page load.

**Cause:** The middleware checks for the session cookie by name. In development the cookie name is `authjs.session-token`. In production (HTTPS) the name is `__Secure-authjs.session-token`. A mismatch causes the middleware to treat the user as unauthenticated.

**Solution:**

- **Development:** Ensure you are accessing the app at `http://localhost:3000` (not HTTPS).
- **Production:** Ensure `AUTH_URL` is set to your HTTPS URL so Auth.js uses `__Secure-` prefixed cookies.
- **Mixed environment:** If you are testing production builds locally without HTTPS, the `__Secure-` cookie will not be sent by the browser (secure cookies require HTTPS). Use HTTP for local testing.

Relevant code in `src/middleware.ts`:
```typescript
const token =
  request.cookies.get("authjs.session-token")?.value ??
  request.cookies.get("__Secure-authjs.session-token")?.value;
```

---

### Email already in use

**Symptom:** Registration or seeding fails with a duplicate key error for the `email` column on the `users` table.

**Cause:** The seed user (`student@ccna.lab`) already exists in the database. The seed script handles this case by skipping the insert, but direct database operations or a custom registration flow may hit the unique constraint.

**Solution:**

- The seed script is idempotent and safe to re-run. It checks for existing users before inserting.
- If you encounter this during registration, use a different email address.
- To reset the seed user:
  ```bash
  docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab \
    -c "DELETE FROM users WHERE email = 'student@ccna.lab';"
  cd apps/web && npm run db:seed
  ```

---

## Lab Engine Issues

### Unhealthy container

**Symptom:**
```bash
$ docker compose -f docker/docker-compose.yml ps
NAME                  STATUS
ccna-studylab-labs    Up (unhealthy)
```

**Cause:** The lab engine container is running but its health check (`GET /health` on port 8100) is failing. This may happen if:

- The FastAPI app failed to start (import error, missing dependency).
- The container started before its dependencies were ready.

**Solution:**

1. Check the container logs:
   ```bash
   docker logs ccna-studylab-labs
   ```
2. Look for Python import errors or startup exceptions.
3. Rebuild the container if dependencies changed:
   ```bash
   docker compose -f docker/docker-compose.yml build lab-engine
   docker compose -f docker/docker-compose.yml up -d lab-engine
   ```
4. Verify the health endpoint manually:
   ```bash
   curl http://localhost:8100/health
   ```
   Expected response:
   ```json
   {"status":"healthy","service":"lab-engine","version":"1.0.0","lab_types":["ios-cli","subnetting","config-review","python","acl-builder"]}
   ```

---

### Port 8100 unreachable

**Symptom:**
```
connect ECONNREFUSED 127.0.0.1:8100
```
or labs show "Lab engine is required" in the UI.

**Cause:** The lab engine container is not running, or the `LAB_ENGINE_URL` environment variable is not set.

**Solution:**

1. Start the lab engine:
   ```bash
   docker compose -f docker/docker-compose.yml up -d lab-engine
   ```
2. Set `LAB_ENGINE_URL` in `apps/web/.env.local`:
   ```
   LAB_ENGINE_URL=http://localhost:8100
   ```
3. Restart the Next.js development server.
4. Without the lab engine, only Python labs support local execution (via a `python3` subprocess). IOS CLI, subnetting, config review, and ACL builder labs require the engine.

---

### CORS errors

**Symptom:**
```
Access to fetch at 'http://localhost:8100/api/v1/grade' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Cause:** The lab engine's CORS middleware only allows `http://localhost:3000` by default. If you are accessing the web app from a different origin (e.g., `http://127.0.0.1:3000`, a custom domain, or a different port), the request is blocked.

**Solution:**

Update the CORS origins in `services/lab-engine/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://your-custom-origin"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Alternatively, in production, configure the Next.js API routes to proxy requests to the lab engine instead of making direct browser-to-engine requests. This avoids CORS entirely.

---

### Unknown lab type

**Symptom:**
```json
{"detail": "Unknown lab type: custom-type"}
```

**Cause:** The lab engine received a `lab_type` value that does not match any of its graders. Valid types are:

| Lab Type | Grader |
|----------|--------|
| `ios-cli` | `grader/ios_grader.py` |
| `subnetting` | `grader/subnet_grader.py` |
| `config-review` | `grader/config_grader.py` |
| `python` | `grader/python_grader.py` |
| `acl-builder` | `grader/acl_grader.py` |

**Solution:**

- Verify the lab's JSON file in `content/labs/` uses a valid `type` value.
- The seed script maps invalid types to `"python"` as a fallback, but the lab engine's grade endpoint returns HTTP 400 for unrecognized types.

---

## Testing Issues

### E2E login redirect

**Symptom:** Playwright E2E tests fail because pages redirect to `/login` instead of rendering dashboard content.

**Cause:** The Playwright config sets `SKIP_AUTH=true` in the `webServer.env` block, but this only applies when Playwright starts its own dev server. If you are running the dev server separately, the `SKIP_AUTH` variable may not be set.

**Solution:**

1. Let Playwright manage the dev server (the default behavior). In `playwright.config.ts`:
   ```typescript
   webServer: {
     command: "npm run dev",
     url: "http://localhost:3000",
     reuseExistingServer: !process.env.CI,
     env: {
       SKIP_AUTH: "true",
     },
   },
   ```

2. If running the dev server yourself, set the variable manually:
   ```bash
   SKIP_AUTH=true npm run dev
   ```

3. If running in CI, ensure `reuseExistingServer` is `false` (the default in CI) so Playwright starts its own server with the correct environment.

---

### Content validation failures

**Symptom:**
```
AssertionError: expected [ 'Flashcard fc-1.1-01: missing field "sourceUrl"' ] to deeply equal []
```

**Cause:** A content JSON file under `content/` is missing a required field, has an invalid value, or references a non-existent objective code.

**Solution:**

1. Run the content validation tests to see all failures:
   ```bash
   cd apps/web
   npm run test:content
   ```

2. The three validation test files check:

   | Test File | What It Validates |
   |-----------|-------------------|
   | `validate-flashcards.test.ts` | Required fields, unique IDs, valid objective codes, difficulty values, source URLs, tags |
   | `validate-practice-exams.test.ts` | Required fields, unique IDs, valid objective codes, correct answer format, option counts, domain coverage, question types |
   | `validate-coverage.test.ts` | Every objective has flashcards and questions, domain distribution matches exam weights, no orphaned content, total objective count (53) |

3. Fix the content files under `content/flashcards/`, `content/practice-exams/`, or `content/exam-blueprint.json` according to the error messages.

---

### Playwright timeout

**Symptom:**
```
Timeout of 30000ms exceeded.
```

**Cause:** The test waited too long for a page element or navigation. This can happen if:

- The dev server has not fully started.
- A network request is hanging (database or API unreachable).
- A selector does not match any element on the page.

**Solution:**

1. Increase the timeout if the test is legitimately slow (heavy page load):
   ```typescript
   test.setTimeout(60_000);
   ```

2. Verify the dev server is fully started before tests run. The `webServer.timeout` in `playwright.config.ts` is set to 120 seconds for server startup.

3. Check that the selectors in the test match the current UI. Component refactors can change element structure.

4. Run with debug output:
   ```bash
   cd apps/web
   npx playwright test --debug
   ```

5. Review traces and screenshots. On failure or first retry, Playwright captures:
   - **Traces:** `trace: "on-first-retry"` — view with `npx playwright show-trace <trace.zip>`
   - **Screenshots:** `screenshot: "only-on-failure"` — saved in the test results directory
   - **Video:** `video: "on-first-retry"` — saved alongside traces

---

## Development Issues

### Hot reload not working

**Symptom:** Changes to `.tsx` or `.ts` files do not appear in the browser without a manual refresh or server restart.

**Cause:** Next.js uses Turbopack for development by default. Hot reload issues can stem from:

- File watchers exceeding the OS limit.
- The file being outside the watched directory tree.
- A syntax error preventing the module from reloading.

**Solution:**

1. On macOS, increase the file watcher limit:
   ```bash
   sudo sysctl -w kern.maxfiles=65536
   sudo sysctl -w kern.maxfilesperproc=65536
   ```

2. On Linux, increase the inotify watcher limit:
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

3. Check the terminal for compilation errors. A syntax error in any imported module can silently break HMR.

4. Restart the dev server:
   ```bash
   cd apps/web
   npm run dev
   ```

For the lab engine, FastAPI hot reload works via volume mounts in Docker Compose:
```yaml
volumes:
  - ../services/lab-engine:/app
```
Changes to Python files under `services/lab-engine/` are reflected without rebuilding the container.

---

### Node version incompatibility

**Symptom:**
```
error@next@16.1.6: The engine "node" is incompatible with this module.
```
or unexpected syntax errors during build.

**Cause:** The project requires Node.js 20 or later. The CI pipeline uses `node-version: 20` explicitly.

**Solution:**

1. Check your Node version:
   ```bash
   node --version
   ```

2. Install Node.js 20+ using a version manager:
   ```bash
   # Using nvm
   nvm install 20
   nvm use 20

   # Using fnm
   fnm install 20
   fnm use 20
   ```

3. Re-install dependencies:
   ```bash
   cd apps/web
   rm -rf node_modules
   npm install
   ```

---

### Docker Desktop not running

**Symptom:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

**Cause:** Docker Desktop (or the Docker daemon) is not started.

**Solution:**

1. **macOS / Windows:** Open Docker Desktop from the Applications menu and wait for the engine to start.
2. **Linux:** Start the Docker daemon:
   ```bash
   sudo systemctl start docker
   ```
3. Verify Docker is running:
   ```bash
   docker ps
   ```
4. Then start the project services:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

---

### AI Tutor API key not configured

**Symptom:** The AI Tutor page loads but sending a message returns a `401 Unauthorized` error or an empty response.

**Cause:** The `TUTOR_ANTHROPIC_KEY` environment variable is not set. The AI Tutor feature requires an Anthropic API key to call the Claude API.

**Solution:**

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/).
2. Add it to `apps/web/.env.local`:
   ```
   TUTOR_ANTHROPIC_KEY=sk-ant-api03-your-key-here
   ```
3. Restart the development server.

**Important:** The variable is named `TUTOR_ANTHROPIC_KEY` (not `ANTHROPIC_API_KEY`) to avoid conflicts with the Claude Code CLI, which reserves `ANTHROPIC_API_KEY` for its own use.

All other features (flashcards, labs, practice exams, study guides) work without this key.

---

## Quick Diagnostic Commands

```bash
# Check all services
docker compose -f docker/docker-compose.yml ps

# View database logs
docker logs ccna-studylab-db

# View lab engine logs
docker logs ccna-studylab-labs

# Test database connection
docker exec -it ccna-studylab-db psql -U studylab -d ccna_studylab -c "SELECT 1;"

# Test lab engine health
curl http://localhost:8100/health

# Verify environment variables
grep -E 'DATABASE_URL|AUTH_SECRET|TUTOR_ANTHROPIC_KEY' apps/web/.env.local

# Full reset (destroys data)
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d
cd apps/web
npm run db:generate && npm run db:migrate && npm run db:seed
```

---

## See Also

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) -- All environment variables and their defaults
- [DEVELOPMENT.md](./DEVELOPMENT.md) -- Developer workflow and debugging tips
- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture and design decisions
- [TESTING.md](./TESTING.md) -- Testing stack and debugging test failures
