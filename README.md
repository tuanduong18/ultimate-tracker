# Ultimate Tracker

> A single web app that tracks your money and subscriptions, your training and recovery, your calendar and where your hours actually go, and your gaming performance — then tells you how they connect.

Most tracking apps live in isolation. Your budget app doesn't know you slept badly. Your fitness app doesn't know you overspent. Ultimate Tracker puts every domain of your daily life in one place specifically so it can surface insights none of those apps can give you alone — *"your focus hours are 40% higher on days you hit your step goal"*, *"you overspend in weeks your gym sessions drop below 2."*

This is a personal project built to be genuinely used daily, while serving as a portfolio piece demonstrating full-stack engineering, clean architecture, and real CI/CD practices.

**🔗 Live app: [ultimate-tracker-one.vercel.app](https://ultimate-tracker-one.vercel.app)**

---

## Why this exists

- Built for people who work at a desk most of the day — the web is where the habit should form, not a phone notification you swipe away.
- Manual logging by design. No fragile background services, no OS permission battles — just fast, low-friction input.
- The headline feature isn't any single tracker. It's the **cross-domain insight engine** that correlates everything once enough data exists.

---

## Features

Five domains, listed in the order they appear in the app.

| # | Domain | Status | What it covers |
|---|---|---|---|
| 1 | 💰 Finance & Budgeting | Partly built | Expenses, categories, multi-currency budgets, spending breakdowns — plus subscriptions with renewal reminders and one-click renew |
| 2 | 🏋️ Health & Fitness | Planned | Gym / swim / sport sessions, personal records, daily steps, sleep, mood, habits |
| 3 | ⏱️ Time Tracking & Calendar | Planned | Focus timer, entertainment budgets, and two-way Google Calendar sync covering timetable, deadlines, dates and events |
| 4 | ✨ Cross-Domain Insights | Planned | Correlation engine and weekly digest across every domain above |
| 5 | 🎮 Gaming Performance | Last | Riot / Steam sync, tilt detection, performance trends |

**Gaming Performance ships last on purpose.** It is the most interesting domain to build, which
makes it the easiest one to start early and the surest way to end up with a half-built
integration and no working sleep log. Keeping it at the end means the unglamorous domains get
finished — and leaves something genuinely fun for the end.

Per-domain specifications live in [`docs/features/`](./docs/features/).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | SSR for fast dashboard loads, strong ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Fast to build, consistent, no design system from scratch |
| Charts | Recharts | Lightweight, React-native, good defaults |
| Backend | FastAPI (Python 3.14) | Async-first, type-safe, fast to build REST APIs |
| Database | PostgreSQL via Supabase | Relational data suits cross-domain queries, generous free tier |
| Auth | Supabase Auth | Email/password + Google OAuth out of the box, no custom auth to maintain |
| Background jobs | APScheduler / Celery (TBD, lands in v0.2) | Subscription reminders need it first; budget alerts and the weekly digest reuse it |
| Calendar sync | Google Calendar API (v0.3) | Two-way sync of timetable and events; `calendar.events` scope only |
| Exchange rates | open.er-api.com | No API key, quotes 160+ currencies including VND; ECB-backed alternatives quote ~30 and omit it |
| CI/CD | GitHub Actions | Lint, test, build, deploy on every PR |
| Code style | Ruff (Python) + Prettier & ESLint (TypeScript) | One formatter per language, enforced in CI and via pre-commit |
| Frontend hosting | Vercel (free tier) | Zero-config Next.js deploys |
| Backend hosting | Render (free tier) | Simple Docker-based deploys for FastAPI |
| Error tracking | Sentry (free tier) | Catch production errors before users report them |

> **No mobile app.** This is a web-only project. Step counts, app usage, and other data that would normally come from a phone are entered manually for now.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.14+
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
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m alembic upgrade head        # run database migrations
python -m uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs auto-generated at `http://localhost:8000/docs`.

> **Why `python -m`?** The console-script shims pip writes into `.venv/Scripts/` (`uvicorn.exe`,
> `alembic.exe`, `pytest.exe`) are unsigned, so Windows Smart App Control blocks them with
> *"An Application Control policy has blocked this file"*. Going through the signed interpreter
> sidesteps it and works identically everywhere else.

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
├── docs/
│   ├── features/   # Per-domain feature specifications
│   └── adr/        # Architecture decision records
├── .github/        # CI/CD workflows
├── docker-compose.yml
├── README.md
├── DeveloperGuide.md
└── CLAUDE.md
```

Full structure and architecture details: [`DeveloperGuide.md`](./DeveloperGuide.md).

---

## Roadmap

Four releases, in order. **No dates.** This is a personal project built around other
commitments, and an invented deadline produces nothing except a missed one. Each release ships
when it is done and the one before it is stable.

| Release | What ships |
|---|---|
| **v0.1** | Auth, Finance core (expenses, categories, multi-currency budgets, spending dashboard), app shell, theming, CI/CD. |
| **v0.2** | Subscriptions end to end, reminders included — so the notification and scheduler service lands here. Budget breach alerts. Health & Fitness training and steps. Focus timer and entertainment budgets. |
| **v0.3** | Two-way Google Calendar sync and events. Sleep, mood and habits. Correlation engine and weekly digest. Onboarding. |
| **v0.4** | Polish, performance pass, full observability, public launch. |
| **Last** | Gaming Performance — Riot and Steam integration, tilt detection. Deliberately after everything else. |

---

## Testing

```bash
# Backend
cd backend && python -m pytest

# Frontend
cd frontend && npm run test
```

CI runs both suites on every pull request — see [`DeveloperGuide.md`](./DeveloperGuide.md#9-cicd-pipeline) for the full pipeline.

---

## Contributing

This is a solo personal project, but built with team-ready practices:

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) — PRs are squash-merged, so the PR title is what gets linted
- Every change goes through a PR, even solo — `main` is protected, keeps a clean history, and forces CI to run
- Migrations are applied to production **before** the code that uses them merges

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full workflow, and
[`DeveloperGuide.md`](./DeveloperGuide.md) for architecture and schema.

---

## License

MIT — see `LICENSE` for details.
