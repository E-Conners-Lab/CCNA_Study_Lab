# CCNA StudyLab -- Contributing Guide

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

Thank you for your interest in contributing to CCNA StudyLab. This document outlines the process for contributing code, content, and documentation.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Branch Naming](#branch-naming)
3. [Commit Messages](#commit-messages)
4. [Pull Request Process](#pull-request-process)
5. [Testing Requirements](#testing-requirements)
6. [Content Contributions](#content-contributions)
7. [Documentation Requirements](#documentation-requirements)
8. [CI Pipeline](#ci-pipeline)

---

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ccna-studylab.git
   cd ccna-studylab
   ```
3. Set up the development environment following the instructions in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
4. Create a branch for your changes (see [Branch Naming](#branch-naming)).
5. Make your changes, commit, push, and open a pull request.

---

## Branch Naming

Use the following prefixes for branch names:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features or capabilities | `feature/add-drag-drop-labs` |
| `fix/` | Bug fixes | `fix/flashcard-scheduling-bug` |
| `docs/` | Documentation changes | `docs/add-deployment-guide` |
| `content/` | Content additions or corrections | `content/domain-3-flashcards` |

Branch names should be lowercase, hyphen-separated, and descriptive.

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `content` | Content additions or updates (flashcards, exams, labs, study guides) |
| `test` | Adding or updating tests |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `style` | Formatting, whitespace, or linting changes |
| `ci` | CI/CD pipeline changes |
| `chore` | Maintenance tasks (dependency updates, build config) |

### Scope

Use the component or area affected:

| Scope | Area |
|-------|------|
| `web` | Next.js web application |
| `labs` | Lab engine service |
| `db` | Database schema or migrations |
| `auth` | Authentication |
| `flashcards` | Flashcard system |
| `exams` | Practice exam system |
| `tutor` | AI Tutor feature |
| `docker` | Docker configuration |

### Examples

```
feat(web): add keyboard shortcuts to exam page
fix(auth): resolve redirect loop when database is unavailable
content(flashcards): add domain 4 IP services flashcards
docs: add deployment guide
test(web): add E2E tests for flashcard review flow
ci: add content validation to pipeline
```

---

## Pull Request Process

### Before Opening a PR

1. Ensure all tests pass locally:
   ```bash
   cd apps/web
   npm test                # Unit tests
   npm run test:content    # Content validation
   npm run lint            # Linting
   npm run build           # Build check
   ```
2. Rebase your branch on the latest `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

### PR Template

Use this format for your pull request description:

```markdown
## Summary

Brief description of the changes and their purpose.

## Changes

- List of specific changes made

## Testing

- How the changes were tested
- New tests added (if any)

## Related Issues

Closes #<issue-number>
```

### Review Checklist

Reviewers will check:

- [ ] Code follows project conventions (TypeScript strict mode, `@/` path alias).
- [ ] New features include tests.
- [ ] Content changes pass `npm run test:content`.
- [ ] No security issues introduced (see `docs/DEPLOYMENT.md` security checklist).
- [ ] Documentation updated for API, route, or schema changes.
- [ ] No unrelated changes bundled in the PR.

---

## Testing Requirements

All tests must pass before a PR can be merged. The CI pipeline enforces this automatically.

### Minimum Requirements

| Change Type | Required Tests |
|-------------|----------------|
| Frontend code | Unit tests (`npm test`) |
| API routes | Unit tests + E2E tests (`npm run test:e2e`) |
| Content JSON files | Content validation (`npm run test:content`) |
| Database schema | Migration test (build must succeed) |
| All changes | Lint (`npm run lint`) + Build (`npm run build`) |

### Writing Tests

- **Unit tests:** Place test files alongside source files as `*.test.ts` or `*.test.tsx`. Use Vitest with `@testing-library/react` for component tests.
- **E2E tests:** Place in `apps/web/src/__tests__/e2e/`. Use Playwright with the Chromium project.
- **Content validation:** If adding a new content type, add a validation test in `tests/content-validation/`.

See [docs/TESTING.md](docs/TESTING.md) for the full testing reference.

---

## Content Contributions

Content contributions (flashcards, practice questions, labs, study guides) are valuable and do not require code changes.

### JSON Schemas

All content files must conform to their respective schemas. Run validation to check:

```bash
cd apps/web
npm run test:content
```

### Flashcards

- Location: `content/flashcards/domain-N.json`
- Required fields: `id`, `objectiveCode`, `question`, `answer`, `explanation`, `sourceUrl`, `difficulty`, `tags`
- `objectiveCode` must match a code in `content/exam-blueprint.json`
- `difficulty` must be `easy`, `medium`, or `hard`
- `sourceUrl` must be a valid HTTP(S) URL
- `tags` must be a non-empty array of strings

### Practice Exam Questions

- Location: `content/practice-exams/*.json`
- Required fields: `id`, `objectiveCode`, `type`, `question`, `options`, `correctAnswer`, `explanation`, `sourceUrl`, `difficulty`, `tags`
- `type` must be one of: `multiple_choice`, `multiple_select`, `drag_drop`, `fill_in_the_blank`
- Multiple choice: exactly 4 options, single-letter `correctAnswer` (`"A"`, `"B"`, etc.)
- Multiple select: at least 4 options, array `correctAnswer` with at least 2 entries

### Labs

- Location: `content/labs/*.json`
- `type` must be one of: `ios-cli`, `subnetting`, `config-review`, `python`, `acl-builder`
- Include `starterCode`, `solutionCode`, `expectedOutput`, `hints`, and `learningObjectives`

### Coverage Requirements

The content validation tests enforce:

- Every exam objective (53 total) has at least 1 flashcard.
- Every exam objective has at least 1 practice question.
- Domain question distribution matches exam weights within 5%.
- No content references non-existent objectives.

---

## Documentation Requirements

Update documentation when making changes to:

| Change | Documentation to Update |
|--------|------------------------|
| API routes (add, modify, remove) | `docs/API_REFERENCE.md`, `docs/ROUTES.md` |
| Database schema | `docs/DATABASE_SCHEMA.md` |
| Environment variables | `docs/ENVIRONMENT_VARIABLES.md` |
| Frontend routes | `docs/ROUTES.md` |
| Docker services | `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md` |
| Test configuration | `docs/TESTING.md` |
| Setup steps | `docs/DEVELOPMENT.md` |

Run the documentation validator after making changes:

```bash
cd apps/web
npm run docs:validate
```

---

## CI Pipeline

The CI pipeline runs on every push to `main` and on all pull requests. It consists of 5 stages:

| Stage | Job | What It Does | Environment |
|-------|-----|-------------|-------------|
| 1 | **Lint** | Runs ESLint | Node 20 |
| 2 | **Unit Tests** | Runs Vitest unit tests | Node 20, `DATABASE_URL=""`, `AUTH_SECRET=ci-test-secret` |
| 3 | **Content Validation** | Validates content JSON files | Node 20 |
| 4 | **Build** | Runs `next build` | Node 20, `DATABASE_URL=""`, `AUTH_SECRET=ci-build-secret` |
| 5 | **E2E Tests** | Runs Playwright tests | Node 20, PostgreSQL 16 service, Chromium |

Stages 1-3 run in parallel. Stage 4 (Build) runs after stages 1-3 pass. Stage 5 (E2E) runs after stage 4 passes.

On E2E failure, the Playwright HTML report is uploaded as a build artifact and retained for 7 days.

---

## See Also

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) -- Development setup and workflow
- [docs/TESTING.md](docs/TESTING.md) -- Testing stack reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) -- System architecture
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) -- Common issues and solutions
