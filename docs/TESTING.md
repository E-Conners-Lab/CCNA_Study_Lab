# CCNA StudyLab -- Testing Reference

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

Comprehensive testing reference for the CCNA StudyLab project. Covers the testing stack, configuration, writing tests, content validation, coverage, CI pipeline integration, and debugging.

---

## Table of Contents

1. [Testing Stack Overview](#testing-stack-overview)
2. [Unit Tests](#unit-tests)
3. [End-to-End Tests](#end-to-end-tests)
4. [Content Validation](#content-validation)
5. [Coverage](#coverage)
6. [CI Pipeline](#ci-pipeline)
7. [Debugging Tests](#debugging-tests)
8. [Test Data](#test-data)

---

## Testing Stack Overview

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit tests | [Vitest](https://vitest.dev/) | Component and utility testing |
| Component rendering | [@testing-library/react](https://testing-library.com/) | React component testing with jsdom |
| DOM assertions | [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| E2E tests | [Playwright](https://playwright.dev/) | Browser-based end-to-end testing |
| Content validation | Vitest (separate config) | JSON content file validation |
| Coverage | v8 (via Vitest) | Code coverage measurement |

---

## Unit Tests

### Configuration

**Config file:** `apps/web/vitest.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Setup file:** `apps/web/vitest.setup.ts`

```typescript
import "@testing-library/jest-dom/vitest";
```

This setup file imports jest-dom matchers so they are available in all test files.

### Key Configuration Details

| Setting | Value | Explanation |
|---------|-------|-------------|
| `environment` | `jsdom` | Provides a browser-like DOM for React component testing |
| `setupFiles` | `vitest.setup.ts` | Imports jest-dom matchers globally |
| `include` | `src/**/*.test.{ts,tsx}` | Test file discovery pattern |
| `exclude` | `node_modules`, `.next` | Skip build artifacts |
| `@` alias | `./src` | Matches the Next.js path alias so imports resolve correctly |

### Running Unit Tests

```bash
cd apps/web

# Run once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage
npm run test:coverage
```

### Writing Unit Tests

Place test files alongside source files with the `.test.ts` or `.test.tsx` extension.

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });
});
```

For React components:

```typescript
// src/components/example.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExampleComponent } from "./example";

describe("ExampleComponent", () => {
  it("renders the title", () => {
    render(<ExampleComponent title="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Mocking

Vitest supports `vi.mock()` for module mocking and `vi.fn()` for function mocking:

```typescript
import { vi, describe, it, expect } from "vitest";

// Mock a module
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
  isDbConfigured: vi.fn(() => false),
}));
```

For environment variables, set them in the test:

```typescript
import { beforeEach, afterEach } from "vitest";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});
```

---

## End-to-End Tests

### Configuration

**Config file:** `apps/web/playwright.config.ts`

```typescript
export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SKIP_AUTH: "true",
    },
  },
});
```

### Key Configuration Details

| Setting | Value | Explanation |
|---------|-------|-------------|
| `testDir` | `src/__tests__/e2e` | E2E test file location |
| `fullyParallel` | `true` | Tests run in parallel |
| `retries` | `0` (dev), `2` (CI) | Retry flaky tests in CI |
| `workers` | `auto` (dev), `1` (CI) | Single worker in CI for stability |
| `timeout` | `30_000` | 30-second test timeout |
| `baseURL` | `http://localhost:3000` | URL for `page.goto("/")` |
| `trace` | `on-first-retry` | Capture traces on first retry |
| `screenshot` | `only-on-failure` | Capture screenshots on failure |
| `video` | `on-first-retry` | Record video on first retry |
| `SKIP_AUTH` | `true` | Bypass auth middleware in tests |

### SKIP_AUTH Bypass

The Playwright config sets `SKIP_AUTH=true` in the `webServer.env` block. This causes the middleware at `src/middleware.ts` to skip authentication checks, so E2E tests can access `/dashboard/*` routes without logging in.

When `SKIP_AUTH=true`:
- The middleware returns `NextResponse.next()` for all routes.
- `getCurrentUserId()` returns `null` (no user context).
- Progress is not saved to the database.

### Running E2E Tests

```bash
cd apps/web

# Install browsers (first time only)
npx playwright install --with-deps chromium

# Run all E2E tests
npm run test:e2e

# Run a specific test file
npx playwright test src/__tests__/e2e/dashboard.spec.ts

# Run in headed mode (visible browser)
npx playwright test --headed

# Run in debug mode (step through)
npx playwright test --debug

# Run with UI mode (interactive)
npx playwright test --ui
```

### Writing E2E Tests

Place test files in `apps/web/src/__tests__/e2e/` with the `.spec.ts` extension.

```typescript
// src/__tests__/e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test("dashboard page loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
});

test("navigation works", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /flashcards/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/flashcards/);
});
```

### Browser Setup

Only Chromium is configured in the Playwright config. To test in other browsers, add projects:

```typescript
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
],
```

Install the additional browsers:

```bash
npx playwright install --with-deps
```

---

## Content Validation

Content validation tests verify that JSON content files under `content/` are well-formed and consistent with the exam blueprint.

### Configuration

**Config file:** `tests/content-validation/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    environment: "node",
    include: [path.resolve(__dirname, "**/*.test.ts")],
  },
  resolve: {
    alias: {
      "@content": path.resolve(__dirname, "../../content"),
    },
  },
});
```

Uses the `node` environment (not jsdom) since these tests work with the filesystem.

### Test Files

| Test File | What It Validates |
|-----------|-------------------|
| `validate-flashcards.test.ts` | Flashcard required fields, unique IDs, valid objective codes, difficulty values (`easy`/`medium`/`hard`), valid source URLs, non-empty tags, minimum 10 flashcards per domain |
| `validate-practice-exams.test.ts` | Question required fields, unique IDs, valid objective codes, correct answer format per question type, multiple choice has 4 options, multiple select has 4+ options with 2+ correct, all 6 domains covered, valid question types, difficulty values, valid source URLs |
| `validate-coverage.test.ts` | Every objective has at least 1 flashcard, every objective has at least 1 practice question, domain question distribution matches exam weights (within 5%), no orphaned content, total objective count equals 53 |

### Running Content Validation

```bash
cd apps/web
npm run test:content
```

### Adding New Validation Checks

1. Create a new test file in `tests/content-validation/` or add tests to an existing file.
2. Load content using `fs.readFileSync` with paths relative to `__dirname`.
3. Use the `@content` alias to reference the content directory.
4. Follow the existing pattern of collecting violations into an array and asserting it equals `[]`:

```typescript
it("description of what is validated", () => {
  const violations: string[] = [];

  for (const item of items) {
    if (!isValid(item)) {
      violations.push(`Item ${item.id}: reason for failure`);
    }
  }

  expect(violations).toEqual([]);
});
```

This pattern produces clear error messages listing all violations instead of failing on the first one.

---

## Coverage

### Configuration

Coverage is configured in `apps/web/vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.{ts,tsx}"],
  exclude: [
    "src/**/*.test.{ts,tsx}",
    "src/**/*.d.ts",
    "src/components/ui/**",
  ],
},
```

### Key Settings

| Setting | Value | Explanation |
|---------|-------|-------------|
| `provider` | `v8` | Uses V8's built-in coverage (faster than Istanbul) |
| `reporter` | `text`, `json`, `html` | Output formats: terminal, machine-readable, and browsable HTML |
| `include` | `src/**/*.{ts,tsx}` | All TypeScript source files |
| `exclude` (test files) | `src/**/*.test.{ts,tsx}` | Do not count test files as coverable code |
| `exclude` (type defs) | `src/**/*.d.ts` | Skip TypeScript declaration files |
| `exclude` (UI primitives) | `src/components/ui/**` | Skip shadcn/ui components (third-party generated code) |

### Running Coverage

```bash
cd apps/web
npm run test:coverage
```

The HTML report is generated in `apps/web/coverage/`. Open `coverage/index.html` in a browser for a detailed view.

### Excluded Paths

The `src/components/ui/**` directory is excluded because it contains generated shadcn/ui components. These are third-party primitives that do not need unit test coverage in this project.

---

## CI Pipeline

The CI pipeline (`.github/workflows/ci.yml`) runs 5 stages:

### Stage 1: Lint

```
Node 20 → npm ci → npm run lint
```

Runs ESLint across the codebase.

### Stage 2: Unit Tests

```
Node 20 → npm ci → npm test
```

Environment: `DATABASE_URL=""`, `AUTH_SECRET=ci-test-secret`

Setting `DATABASE_URL=""` ensures tests do not require a live database. The lazy connection pattern in `lib/db/index.ts` only throws when `getDb()` is called, not at import time.

### Stage 3: Content Validation

```
Node 20 → npm ci (root + apps/web) → npm run test:content
```

Validates all JSON content files. Requires `npm ci` at both the root and `apps/web` levels because the content validation config is in the root `tests/` directory.

### Stage 4: Build

```
Node 20 → npm ci → npm run build
```

Environment: `DATABASE_URL=""`, `AUTH_SECRET=ci-build-secret`

Runs after stages 1-3 pass. Verifies the application compiles without errors.

### Stage 5: E2E Tests

```
Node 20 → PostgreSQL 16 service → npm ci → playwright install → db:generate → db:migrate → db:seed → test:e2e
```

Environment:
- `DATABASE_URL=postgresql://studylab:studylab_ci@localhost:5432/studylab`
- `AUTH_SECRET=ci-e2e-secret`

Runs after stage 4 passes. Uses a PostgreSQL service container. On failure, the Playwright HTML report is uploaded as a build artifact (retained 7 days).

### Pipeline Diagram

```
┌──────┐  ┌────────────┐  ┌────────────────────┐
│ Lint │  │ Unit Tests │  │ Content Validation │
└──┬───┘  └─────┬──────┘  └─────────┬──────────┘
   │            │                    │
   └────────────┼────────────────────┘
                │
           ┌────▼────┐
           │  Build  │
           └────┬────┘
                │
          ┌─────▼─────┐
          │ E2E Tests │
          └───────────┘
```

---

## Debugging Tests

### Vitest

**Watch mode** re-runs tests on file changes:

```bash
npm run test:watch
```

**Run a single file:**

```bash
npx vitest run src/lib/utils.test.ts
```

**Run tests matching a name:**

```bash
npx vitest run -t "should calculate progress"
```

**Verbose output:**

```bash
npx vitest run --reporter=verbose
```

### Playwright

**Debug mode** opens a headed browser with step-through controls:

```bash
npx playwright test --debug
```

**UI mode** provides an interactive test runner:

```bash
npx playwright test --ui
```

**View traces** from failed test runs:

```bash
npx playwright show-trace test-results/example-test/trace.zip
```

**View the HTML report** after a test run:

```bash
npx playwright show-report
```

### Trace, Screenshot, and Video Artifacts

The Playwright config captures artifacts on failure:

| Artifact | When Captured | Location |
|----------|---------------|----------|
| Trace | On first retry | `test-results/<test-name>/trace.zip` |
| Screenshot | On failure | `test-results/<test-name>/screenshot.png` |
| Video | On first retry | `test-results/<test-name>/video.webm` |

Traces contain a full recording of the test execution including DOM snapshots, network requests, and console logs. Open with `npx playwright show-trace`.

### Common Debugging Scenarios

**Test cannot find an element:**
- Check that the selector matches the current UI.
- Use `await page.pause()` in debug mode to inspect the page.
- Add `await page.screenshot({ path: "debug.png" })` to capture the page state.

**Test times out:**
- Increase the timeout: `test.setTimeout(60_000)`.
- Check that the dev server started correctly.
- Verify network requests are resolving (database, API routes).

**Tests pass locally but fail in CI:**
- CI uses a single worker (`workers: 1`) and 2 retries.
- CI uses a fresh PostgreSQL service, not a Docker container.
- Check the uploaded Playwright report artifact for screenshots and traces.

---

## Test Data

### Seed User

The database seed script creates a default user for testing:

| Field | Value |
|-------|-------|
| Email | `student@ccna.lab` |
| Password | `ccna123` |
| Name | `Student` |
| Password hash | bcrypt with 12 rounds |

The seed script is idempotent: if the user already exists, it is skipped.

### Content Fixtures

Content tests load data directly from the `content/` directory:

| Content Type | Location | Count |
|-------------|----------|-------|
| Exam blueprint | `content/exam-blueprint.json` | 6 domains, 53 objectives |
| Flashcards | `content/flashcards/domain-*.json` | ~199 flashcards |
| Practice exams | `content/practice-exams/*.json` | Multiple exams |
| Labs | `content/labs/*.json` | 7 labs |
| Study guides | `content/study-guides/*.json` | 6 guides |

### E2E Test Environment

E2E tests run with `SKIP_AUTH=true`, which bypasses authentication. Tests access pages directly without logging in. If a test needs to verify authenticated behavior, start the dev server without `SKIP_AUTH` and use Playwright's login flow.

In CI, the E2E stage provisions a full PostgreSQL database with migrations and seed data, providing a realistic data environment.

---

## See Also

- [DEVELOPMENT.md](./DEVELOPMENT.md) -- Developer workflow and running modes
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) -- Common test failure solutions
- [CONTRIBUTING.md](../CONTRIBUTING.md) -- Testing requirements for pull requests
