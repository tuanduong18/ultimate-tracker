# Ultimate Tracker

> A single web app that tracks your finances, fitness, steps, focused time, entertainment time, sleep, mood, habits, and gaming performance — then tells you how they connect.

Most tracking apps live in isolation. Your budget app doesn't know you slept badly. Your fitness app doesn't know you overspent. Ultimate Tracker puts every domain of your daily life in one place specifically so it can surface insights none of those apps can give you alone — *"your focus hours are 40% higher on days you hit your step goal"*, *"you overspend in weeks your gym sessions drop below 2."*

This is a personal project built to be genuinely used daily, while serving as a portfolio piece demonstrating full-stack engineering, clean architecture, and real CI/CD practices.

---

## Why this exists

- Built for people who work at a desk most of the day — the web is where the habit should form, not a phone notification you swipe away.
- Manual logging by design. No fragile background services, no OS permission battles — just fast, low-friction input.
- The headline feature isn't any single tracker. It's the **cross-domain insight engine** that correlates everything once enough data exists.

---

## Features

| Domain | Status | Examples |
|---|---|---|
| 💰 Finance & Budgeting | Core | Transaction logging, custom categories, budget caps, breach alerts |
| 👣 Steps & Walking | Core | Manual daily step log, goal tracking, calendar heatmap |
| 🏋️ Fitness (Gym / Swim / Sport) | Core | Session logging, exercise library, personal records, progressive overload |
| ⏱️ Time Tracking | Core | Focus timer, entertainment time budgets, daily breakdown |
| ❤️ Wellness | Core | Mood + energy check-in, sleep log, custom habit tracker |
| ✨ Cross-Domain Insights | Core | Weekly AI digest, correlation engine, insights dashboard |
| 🎮 Gaming Performance | Future | Riot/Steam API sync, tilt detection, performance trends |

Full feature breakdown with functional requirements lives in [`DeveloperGuide.md`](./DeveloperGuide.md#6-features--functional-requirements).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR for fast dashboard loads, strong ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Fast to build, consistent, no design system from scratch |
| Charts | Recharts | Lightweight, React-native, good defaults |
| Backend | FastAPI (Python 3.11+) | Async-first, type-safe, fast to build REST APIs |
| Database | PostgreSQL via Supabase | Relational data suits cross-domain queries, generous free tier |
| Auth | Supabase Auth | Email/password + Google OAuth out of the box, no custom auth to maintain |
| Background jobs | APScheduler / Celery (TBD in v0.3) | Weekly digest + correlation engine need scheduled compute |
| CI/CD | GitHub Actions | Lint, test, build, deploy on every PR |
| Frontend hosting | Vercel (free tier) | Zero-config Next.js deploys |
| Backend hosting | Render (free tier) | Simple Docker-based deploys for FastAPI |
| Error tracking | Sentry (free tier) | Catch production errors before users report them |

> **No mobile app.** This is a web-only project. Step counts, app usage, and other data that would normally come from a phone are entered manually for now.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker + Docker Compose
- A free [Supabase](https://supabase.com) project (Postgres + Auth)
- A free [Render](https://render.com) account (for backend deploys)
- A free [Vercel](https://vercel.com) account (for frontend deploys)

### 1. Clone and configure

```bash
git clone https://github.com/<your-username>/ultimate-tracker.git
cd ultimate-tracker
cp .env.example .env
```

Fill in `.env` with your Supabase project URL, anon key, service role key, and database connection string (found in your Supabase project settings).

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head        # run database migrations
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs auto-generated at `http://localhost:8000/docs`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 4. Or run everything with Docker Compose

```bash
docker compose up --build
```

---

## Project Structure (overview)

```
ultimate-tracker/
├── frontend/       # Next.js app
├── backend/        # FastAPI app
├── docs/           # Architecture diagrams, ADRs
├── .github/        # CI/CD workflows
├── docker-compose.yml
├── README.md
├── DeveloperGuide.md
└── CLAUDE.md
```

Full structure and architecture details: [`DeveloperGuide.md`](./DeveloperGuide.md).

---

## Roadmap

18 weeks, a usable release every 4 weeks.

| Release | Weeks | What ships |
|---|---|---|
| **v0.1** | 1–4 | Auth, Finance (transactions + budgets), Steps (manual log), unified dashboard skeleton. CI/CD live from day 1. |
| **v0.2** | 5–8 | Focus timer + entertainment budgets, Fitness session logging + PRs, dashboard charts. |
| **v0.3** | 9–12 | Sleep + mood check-in, habit tracker, correlation engine v1, weekly AI digest. |
| **v0.4** | 13–18 | Polish, performance, observability, public launch. Gaming API foundation (future). |

---

## Testing

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run test
```

CI runs both suites on every pull request — see [`DeveloperGuide.md`](./DeveloperGuide.md#9-cicd-pipeline) for the full pipeline.

---

## Contributing

This is a solo personal project, but built with team-ready practices:

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Every change goes through a PR, even solo — keeps a clean history and forces CI to run
- See [`DeveloperGuide.md`](./DeveloperGuide.md#8-branching-strategy--git-workflow) for the full workflow

---

## License

MIT — see `LICENSE` for details.
