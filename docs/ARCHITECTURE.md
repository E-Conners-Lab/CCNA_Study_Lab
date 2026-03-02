# CCNA StudyLab -- Architecture Document

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema Overview](#database-schema-overview)
7. [Docker Services](#docker-services)
8. [Security Considerations](#security-considerations)
9. [Design Decisions Log](#design-decisions-log)

---

## Project Overview

**CCNA StudyLab** is a hybrid study platform for the **Cisco CCNA (200-301)** certification exam. It combines structured study content, hands-on networking labs, AI-powered tutoring, spaced-repetition flashcards, and interactive practice exams into a single, self-hosted learning environment.

The platform is organized around the six exam domains:

| Domain | Name | Weight |
|--------|------|--------|
| 1 | Network Fundamentals | 20% |
| 2 | Network Access | 20% |
| 3 | IP Connectivity | 25% |
| 4 | IP Services | 10% |
| 5 | Security Fundamentals | 15% |
| 6 | Automation & Programmability | 10% |

### Key Features

- **Study Hub** -- Objective-by-objective tracking aligned to the CCNA 200-301 exam blueprint
- **Hands-on Labs** -- Interactive labs with auto-grading (IOS CLI, subnetting, config review, Python, ACL building)
- **Practice Exams** -- Multiple choice, multiple select, drag-and-drop, and fill-in-the-blank questions
- **Flashcards** -- SM-2 spaced repetition algorithm for long-term retention
- **AI Tutor** -- Claude-powered conversational tutor with domain-specific expertise and streaming responses

---

## System Architecture

```
                         +-------------------+
                         |   Browser Client  |
                         | (Next.js Frontend)|
                         +--------+----------+
                                  |
                                  | HTTPS (port 3000)
                                  |
                   +--------------+---------------+
                   |      Next.js 16 App Server   |
                   |  +---------+  +-----------+  |
                   |  |   App   |  |  API      |  |
                   |  | Router  |  |  Routes   |  |
                   |  | (RSC +  |  | /api/chat |  |
                   |  |  Client)|  | /api/...  |  |
                   |  +---------+  +-----+-----+  |
                   +------|--------------|--------+
                          |              |
              +-----------+    +---------+---------+
              |                |                   |
              v                v                   v
     +--------+------+  +-----+-------+   +-------+--------+
     |  PostgreSQL   |  | Anthropic   |   |  Lab Engine     |
     |  (port 5433)  |  | Claude API  |   |  FastAPI :8100  |
     |  ccna_studylab|  | (external)  |   +----------------+
     |  Drizzle ORM  |  +-------------+   | Graders:       |
     +---------------+                    |  ios_grader    |
                                          |  subnet_grader |
                                          |  config_grader |
                                          |  acl_grader    |
                                          +----------------+
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.1.6 | Full-stack React framework with App Router |
| **Language** | TypeScript | 5.x | Type-safe frontend and tooling |
| **UI Library** | React | 19.2.3 | Component-based UI |
| **Styling** | Tailwind CSS | v4 | Utility-first CSS framework |
| **Components** | shadcn/ui + Radix UI | 1.4.3 | Accessible, composable component primitives |
| **Icons** | Lucide React | 0.575.0 | Consistent icon set |
| **Database** | PostgreSQL | 16 (Alpine) | Primary data store |
| **ORM** | Drizzle ORM | 0.45.1 | Type-safe SQL query builder and schema |
| **Auth** | Auth.js (NextAuth v5) | 5.0.0-beta.30 | Authentication and session management |
| **AI** | Anthropic Claude API | SDK 0.78.0 | AI Tutor chat with streaming |
| **Lab Engine** | FastAPI (Python) | latest | Lab grading (IOS CLI, subnetting, config review, ACL) and sandbox execution |
| **Containers** | Docker Compose | 3.9 | Service orchestration |
| **Validation** | Zod | 4.3.6 | Runtime schema validation |
| **Dates** | date-fns | 4.1.0 | Date formatting and manipulation |
| **IDs** | nanoid / uuid | 5.1.6 / 13.0.0 | Unique identifier generation |

---

## Frontend Architecture

### App Router Structure

The application uses the Next.js App Router with the following layout hierarchy:

```
app/
  layout.tsx              # Root layout (html, body, font loading)
  page.tsx                # Root page -- redirects to /dashboard
  dashboard/
    layout.tsx            # Dashboard layout (sidebar + main content area)
    page.tsx              # Dashboard home -- progress overview
    study/
      page.tsx            # Study Hub -- objectives by domain
      [slug]/page.tsx     # Domain study guide
    labs/
      page.tsx            # Hands-on lab catalog
      [slug]/page.tsx     # Lab execution environment
    practice/
      page.tsx            # Practice exams and past attempts
      exam/page.tsx       # Exam-taking interface
    flashcards/
      page.tsx            # Spaced repetition flashcard system
    tutor/
      page.tsx            # AI Tutor chat interface
    settings/
      page.tsx            # User settings and preferences
  api/
    chat/
      route.ts            # POST /api/chat -- streaming AI responses
```

### Server vs Client Components

| Component Type | Usage |
|---------------|-------|
| **Server Components** | Root layout, root page (redirect), future data-fetching pages |
| **Client Components** | All dashboard pages (interactive state management, event handlers) |

Currently all dashboard pages use `"use client"` because they manage local UI state (expanded sections, active tabs, form inputs, chat messages). As the platform matures, data fetching will move to server components with client-side interactivity isolated to leaf components.

### Component Hierarchy

```
DashboardLayout
  +-- Sidebar (navigation, branding)
  +-- ScrollArea (main content)
       +-- DashboardPage
       |     +-- StatsCard (x4)
       |     +-- DomainCard (x6)
       |     +-- RecentActivity
       +-- StudyPage
       |     +-- DomainAccordion (x6)
       |     +-- ObjectiveChecklist
       +-- LabsPage
       |     +-- FilterTabs
       |     +-- LabCard (x7)
       +-- PracticePage
       |     +-- StatsCard (x4)
       |     +-- ExamStarter
       |     +-- PastAttemptsList
       +-- FlashcardsPage
       |     +-- StatsCard (x3)
       |     +-- FlashcardReview (SM-2 ratings)
       |     +-- CardLibraryGrid
       +-- TutorPage
             +-- ConversationSidebar
             +-- DomainSelector
             +-- ChatMessageList
             +-- QuickPrompts
             +-- InputArea
```

### UI Design System

- **Color Palette:** Zinc-based dark theme with blue accents
- **Typography:** System font stack via Next.js font optimization
- **Spacing:** Tailwind spacing scale (4px base unit)
- **Components:** shadcn/ui primitives (Card, Badge, Button, Progress, ScrollArea, Select, Tabs, DropdownMenu, Sheet, Tooltip, Separator)
- **Responsive:** Mobile-first with breakpoints at `sm` (640px), `md` (768px), `lg` (1024px)

---

## Backend Architecture

### Next.js API Routes (Web Backend)

The Next.js server handles web-facing API routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | Auth.js authentication handlers |
| `/api/chat` | POST | AI Tutor -- streams Claude responses via ReadableStream |
| `/api/dashboard/stats` | GET | Aggregated dashboard statistics |
| `/api/exams` | GET | List practice exams |
| `/api/exams/{examId}` | GET | Get exam with questions (answers stripped) |
| `/api/exams/{examId}/grade` | POST | Grade exam submission, persist attempt |
| `/api/exams/attempts` | GET | Past exam attempts |
| `/api/flashcards` | GET | List all flashcards |
| `/api/flashcards/progress` | GET/POST | SM-2 flashcard progress sync |
| `/api/labs` | GET | List labs |
| `/api/labs/{slug}` | GET | Get lab details |
| `/api/labs/{slug}/run` | POST | Execute lab code |
| `/api/labs/{slug}/solution` | GET | Get lab solution |
| `/api/labs/attempts` | GET | Lab completion status |
| `/api/study/{slug}` | GET | Get study guide |
| `/api/study/progress` | GET/POST | Objective completion tracking |
| `/api/tutor/conversations` | GET/POST | List/create tutor conversations |
| `/api/tutor/conversations/{id}` | GET/PATCH/DELETE | Get/update/delete a conversation |
| `/api/tutor/conversations/{id}/messages` | POST | Save a message to a conversation |

The chat route:
1. Validates the API key from environment variables
2. Validates the incoming message array
3. Selects a domain-specific system prompt (or the general tutor prompt)
4. Opens a streaming connection to the Anthropic Claude API (claude-sonnet-4-20250514)
5. Returns a `text/plain` ReadableStream with chunked transfer encoding

### FastAPI Lab Engine (port 8100)

The Lab Engine is a Python FastAPI service that handles lab grading across multiple CCNA lab types:

| Router | Prefix | Purpose |
|--------|--------|---------|
| Health | `/health` | Service health check |
| Exercises | `/api/v1/exercises` | List and retrieve lab exercises |
| Grade | `/api/v1/grade` | Grade submitted lab work |
| Sandbox | `/api/v1/sandbox` | Run code in a sandboxed subprocess |

**Lab Types:**

| Type | Description |
|------|-------------|
| `ios-cli` | IOS command-line interface exercises |
| `subnetting` | IP subnetting and addressing calculations |
| `config-review` | Router/switch configuration analysis |
| `python` | Python networking automation scripts |
| `acl-builder` | Access control list construction |

**Graders:**

| Grader | File | Handles |
|--------|------|---------|
| IOS Grader | `ios_grader.py` | IOS CLI command validation and output matching |
| Subnet Grader | `subnet_grader.py` | Subnetting calculations and VLSM verification |
| Config Grader | `config_grader.py` | Configuration correctness and best-practice checks |
| ACL Grader | `acl_grader.py` | ACL rule ordering, syntax, and permit/deny logic |

**Grading Pipeline:**
1. Student submission is routed to the appropriate grader based on lab type
2. For code-based labs (Python), code is written to a temporary file and executed in a subprocess with restricted environment variables
3. stdout/stderr captured with configurable timeout (default 10s)
4. Output compared against expected criteria (varies by grader)
5. Score assigned: 1.0 (pass), 0.25 (partial -- runs but wrong output), 0.0 (error/timeout)

---

## Database Schema Overview

The PostgreSQL database contains **16 tables** organized into five categories:

### Auth Tables (4 tables)
- `users` -- User accounts
- `accounts` -- OAuth provider accounts (Auth.js adapter)
- `sessions` -- Active sessions
- `verification_tokens` -- Email verification tokens

### Content Tables (4 tables)
- `domains` -- Six exam domains with weights
- `objectives` -- Exam objectives per domain
- `flashcards` -- Flashcard content (question, answer, explanation)
- `practice_questions` -- Practice exam questions (multiple types)

### Progress Tables (4 tables)
- `flashcard_progress` -- SM-2 spaced repetition state per user per card
- `study_progress` -- Per-objective completion tracking
- `practice_attempts` -- Exam attempt records
- `practice_answers` -- Individual answers within attempts

### Lab Tables (2 tables)
- `labs` -- Lab definitions (instructions, starter code, validation)
- `lab_attempts` -- User lab submissions and grades

### AI Tutor Tables (2 tables)
- `tutor_conversations` -- Conversation metadata
- `tutor_messages` -- Individual chat messages

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete table definitions.

---

## Docker Services

The `docker/docker-compose.yml` defines two services:

| Service | Container Name | Image | Port | Purpose |
|---------|---------------|-------|------|---------|
| `postgres` | ccna-studylab-db | postgres:16-alpine | 5433 | Primary database (`ccna_studylab`) |
| `lab-engine` | ccna-studylab-labs | Custom (Dockerfile) | 8100 | Lab grading and code sandbox |

### Volumes
- `pgdata` -- PostgreSQL data persistence

### Health Checks
- **PostgreSQL:** `pg_isready -U studylab` every 10s
- **Lab Engine:** HTTP GET to `/health` every 15s

### Dependencies
- Lab Engine depends on PostgreSQL (waits for `service_healthy`)

---

## Security Considerations

### Authentication & Authorization
- **Auth.js v5** manages sessions with secure HTTP-only cookies
- OAuth providers supported via the `accounts` table (GitHub, Google, etc.)
- Credential-based login with bcrypt-hashed passwords (`hashed_password` column)
- Sessions use JWT strategy stored in secure HTTP-only cookies (not database sessions)

### API Key Management
- Anthropic API key stored in environment variables (`TUTOR_ANTHROPIC_KEY` -- named to avoid conflicts with the Claude Code CLI environment)
- Never exposed to the client -- all Claude API calls happen server-side

### CORS Policy
- Lab Engine restricts origins to `http://localhost:3000`

### Input Validation
- Chat API validates message array structure (role and content required)
- Zod schemas available for runtime validation of request bodies
- FastAPI uses Pydantic models for automatic request validation

### Sandboxed Execution
- Student code runs in isolated subprocesses with restricted `env`
- Only `PATH`, `PYTHONPATH` (empty), `HOME`, and `LANG` environment variables exposed
- Configurable timeout prevents infinite loops and resource exhaustion
- Temporary files are created and cleaned up per execution

### Docker Network Isolation
- Each service runs in its own container
- PostgreSQL credentials use environment variables with defaults
- Services communicate over the Docker bridge network
- Only necessary ports are published to the host

---

## Design Decisions Log

### 1. Why Next.js 16 App Router

**Decision:** Use Next.js with the App Router instead of Pages Router or a separate SPA framework.

**Rationale:**
- **Server Components** reduce client-side JavaScript bundle size for content-heavy pages
- **Streaming** enables progressive rendering for the AI Tutor chat interface
- **Colocation** keeps page components, layouts, and API routes in a unified directory structure
- **React 19 support** provides the latest concurrent features
- **Built-in API routes** eliminate the need for a separate Node.js backend for web-facing endpoints

**Trade-offs:** App Router is newer and has a steeper learning curve. Some libraries have not yet fully adapted to RSC patterns.

### 2. Why Drizzle ORM

**Decision:** Use Drizzle ORM instead of Prisma, TypeORM, or raw SQL.

**Rationale:**
- **Type-safe** schema definitions that double as TypeScript types
- **Lightweight** -- no heavy runtime or binary engine (unlike Prisma)
- **PostgreSQL-native** features: `pgEnum`, `jsonb`, `uuid`, `pgTable`
- **SQL-like API** keeps developers close to the actual queries being generated
- **Relational queries** for complex joins without raw SQL
- **Auth.js adapter** available (`@auth/drizzle-adapter`)

**Trade-offs:** Smaller ecosystem and fewer guides compared to Prisma. No auto-generated migrations GUI.

### 3. Why FastAPI for Lab Engine

**Decision:** Use Python FastAPI for the lab grading service instead of a Node.js service.

**Rationale:**
- **Python-native grading** -- Python labs grade natively in the same runtime
- **Subprocess execution** -- Python's `subprocess` module provides fine-grained control over sandboxed execution
- **Async support** -- FastAPI's async handlers prevent grading operations from blocking other requests
- **OpenAPI docs** -- auto-generated Swagger UI at `/docs` for development and testing
- **Networking libraries** -- Python has strong networking libraries (ipaddress, ciscoconfparse) useful for grading subnetting and config review labs

**Trade-offs:** Introduces a second runtime language. Docker mitigates deployment complexity.

### 4. Why Multiple Specialized Graders

**Decision:** Implement separate grader modules (`ios_grader.py`, `subnet_grader.py`, `config_grader.py`, `acl_grader.py`) instead of a single generic grader.

**Rationale:**
- **Domain-specific logic** -- each CCNA lab type has fundamentally different validation requirements (e.g., IOS command syntax vs. subnet math vs. ACL rule ordering)
- **Maintainability** -- grader logic is isolated; changes to subnetting validation do not risk breaking IOS CLI grading
- **Testability** -- each grader can be unit-tested independently with domain-specific fixtures
- **Extensibility** -- new lab types can be added by creating a new grader module and registering it

**Trade-offs:** Slightly more code to maintain across multiple files. A shared base class or interface keeps common patterns consistent.

### 5. Why SM-2 for Flashcard Spacing

**Decision:** Implement the SM-2 (SuperMemo 2) algorithm for flashcard spaced repetition.

**Rationale:**
- **Proven algorithm** -- decades of research backing its effectiveness for long-term retention
- **Simple to implement** -- only requires `ease`, `interval`, and `repetitions` state per card
- **Predictable scheduling** -- students understand when cards will reappear
- **Low computational cost** -- no ML model or external service required

**Trade-offs:** SM-2 is less adaptive than newer algorithms (FSRS, SM-18). The four-button rating system (Again, Hard, Good, Easy) adds slight cognitive overhead.

### 6. Why Streaming for AI Tutor

**Decision:** Stream Claude API responses via chunked transfer encoding instead of waiting for the complete response.

**Rationale:**
- **Better UX** -- users see text appear progressively, reducing perceived latency
- **Lower time-to-first-byte** -- the first tokens arrive within 200-500ms
- **Natural reading pace** -- streaming text mimics a tutor typing in real time
- **Memory efficient** -- responses are not buffered entirely in server memory

**Trade-offs:** More complex client-side rendering (accumulating chunks). Error handling must account for mid-stream failures. Requires `ReadableStream` API support in the browser.
