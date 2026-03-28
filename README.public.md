<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="CCNA StudyLab Dashboard" width="800" />
</p>

<h1 align="center">CCNA StudyLab</h1>

<p align="center">
  <strong>The all-in-one study platform for the Cisco CCNA 200-301 certification exam.</strong><br/>
  Interactive labs, AI tutoring, spaced-repetition flashcards, practice exams, and progress tracking — all in one app.
</p>

<p align="center">
  <a href="https://www.thetech-e.com"><img src="https://img.shields.io/badge/Get_It_Now-thetech--e.com-blue?style=for-the-badge" alt="Get CCNA StudyLab" /></a>
</p>

---

## What You Get

CCNA StudyLab is a **full-stack, self-hosted** study platform you download, install, and run locally. Everything stays on your machine — your progress, your data, your pace.

### Interactive Dashboard

Track your CCNA 200-301 exam preparation with real-time stats: overall completion, study streaks, best scores, and weighted exam readiness across all six domains.

![Dashboard](docs/screenshots/dashboard.png)

### Study Hub — All 6 Domains, 53 Objectives

In-depth study guides for every exam objective with completion tracking, key points, and practice scenarios. Check off objectives as you master them and watch your domain coverage grow.

![Study Hub](docs/screenshots/study-hub.png)

### Hands-on Labs with IOS CLI Simulator

**10 interactive labs** covering all 6 exam domains:

- **7 IOS CLI labs** with a built-in Cisco IOS terminal simulator — configure VLANs, OSPF, static routes, NAT, EtherChannel, ACLs, and SSH directly in the browser
- **1 subnetting lab** with an interactive IPv4 calculator
- **2 Python labs** for Domain 6 (Automation and Programmability)

The IOS simulator supports real command abbreviations (`conf t`, `sh ip int br`, `int Gi0/0`), simulated `show` command output, multi-device labs with device switching, and **automatic grading** against solution configs.

![Hands-on Labs](docs/screenshots/hands-on-labs.png)

### Practice Exams — 140 Questions

- **2 full-length 40-question** sample exams
- **6 focused domain quizzes**
- Timed exam mode with auto-submit
- Scoring, detailed results with explanations
- Attempt history and pass rate tracking

![Practice Exams](docs/screenshots/practice-exams.png)

### Flashcards with Spaced Repetition

**201 flashcards** across all 6 domains powered by the **SM-2 spaced repetition algorithm**. Rate each card's difficulty and the system optimizes your review schedule so you spend time on what you don't know yet.

![Flashcards](docs/screenshots/flashcards.png)

### AI Tutor (Powered by Claude)

A conversational AI tutor with **domain-specific expertise** across all 6 CCNA domains. Ask questions, get explanations with CLI examples, walk through subnetting problems step-by-step, or quiz yourself.

- Domain-specific system prompts for focused study
- Suggested questions to get started
- Persistent conversation history
- *(Requires your own Anthropic API key)*

![AI Tutor](docs/screenshots/ai-tutor.png)

---

## What's Included

| Feature | Details |
|---------|---------|
| **Study Guides** | 6 domain guides covering all 53 CCNA 200-301 objectives |
| **Flashcards** | 201 cards with SM-2 spaced repetition |
| **Practice Exams** | 2 full exams + 6 domain quizzes (140 questions) |
| **Hands-on Labs** | 10 labs with IOS CLI simulator and auto-grading |
| **AI Tutor** | Claude-powered tutor with domain expertise |
| **Progress Tracking** | Dashboard with streaks, scores, and exam readiness |
| **Full Source Code** | Next.js, React, PostgreSQL, FastAPI — yours to customize |
| **Automated Installer** | One command to install and run |
| **Documentation** | Architecture docs, API reference, setup guide |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS v4, shadcn/ui |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 (via Docker) |
| AI | Anthropic Claude API |
| Lab Engine | FastAPI (Python) with IOS/subnet/ACL/config graders |
| Testing | Playwright, Vitest, pytest (190+ tests) |

---

## Requirements

- **Node.js 20+**
- **Docker Desktop**
- **Anthropic API key** *(optional, for AI Tutor)*

---

## Quick Start

```bash
# Extract, install, and run — one command
bash install.sh
```

The installer handles everything: dependency installation, database setup, content seeding, and server startup. Open `http://localhost:3000` and start studying.

---

## CCNA 200-301 Exam Domains

| # | Domain | Weight | Content |
|---|--------|--------|---------|
| 1 | Network Fundamentals | 20% | Study guide, flashcards, quiz, labs |
| 2 | Network Access | 20% | Study guide, flashcards, quiz, labs |
| 3 | IP Connectivity | 25% | Study guide, flashcards, quiz, labs |
| 4 | IP Services | 10% | Study guide, flashcards, quiz, labs |
| 5 | Security Fundamentals | 15% | Study guide, flashcards, quiz, labs |
| 6 | Automation & Programmability | 10% | Study guide, flashcards, quiz, labs |

---

<p align="center">
  <a href="https://www.thetech-e.com"><strong>Get CCNA StudyLab at thetech-e.com</strong></a>
</p>

<p align="center">
  Copyright &copy; 2026 Elliot Conner. All rights reserved.
</p>
