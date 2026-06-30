# CLAUDE.md

This file gives Claude (or any AI coding assistant) the context needed to work productively in this repository. Read this before making any changes.

## Project summary

Ultimate Tracker is a web-only personal tracking app covering finance, steps, fitness, time (focus + entertainment), wellness (mood, sleep, habits), and — eventually — gaming performance. The product's core differentiator is **cross-domain insight generation**: correlating data across all tracked domains to surface patterns no single-purpose app could find (e.g. "focus hours are higher on days you hit your step goal").

No mobile app exists or is planned in this repo. Everything is manual-entry, web-first, designed for someone sitting at a desk most of the day.

Full feature list and functional requirements: see [`DeveloperGuide.md`](./DeveloperGuide.md#6-features--functional-requirements).
Architecture and schema: see [`DeveloperGuide.md`](./DeveloperGuide.md#1-architecture-overview).

## Tech stack quick reference

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: FastAPI (Python 3.11+, async), SQLAlchemy 2.0 (async), Alembic, Pydantic v2
- **Database / Auth**: Supabase (Postgres + Auth) — backend verifies Supabase JWTs, does not manage its own auth tables
- **Hosting**: Vercel (frontend), Render (backend)
- **Testing**: Pytest (backend), Vitest + React Testing Library (frontend)

## Repository structure cheat sheet

```
frontend/app/<domain>/        → page routes (finance, steps, fitness, time, wellness, insights, settings)
frontend/components/          → reusable UI (ui/ = shadcn primitives, charts/, shared/)
frontend/lib/api-client.ts    → typed fetch wrapper — all API calls go through here, not raw fetch()

backend/app/api/v1/<domain>.py   → route handlers, thin — no business logic here
backend/app/services/<domain>.py → business logic lives here
backend/app/models/              → SQLAlchemy ORM models
backend/app/schemas/             → Pydantic Create/Update/Read schemas, one set per domain
backend/app/tasks/                → scheduled jobs (weekly digest, correlation engine)
```

## Conventions to always follow

- **New feature pattern (backend)**: model → schema → service → API route → test, in that order. Never put business logic directly in a route handler.
- **Schemas**: every domain needs separate `Create`, `Update`, and `Read` Pydantic schemas — don't reuse one schema for all three operations.
- **API routes**: versioned under `/api/v1/`, RESTful resource naming, Bearer JWT auth on every protected route.
- **Error responses**: always the standard shape — `{"error": {"code": "...", "message": "..."}}`. Never return raw exception strings.
- **Frontend API calls**: always go through `lib/api-client.ts`, never call `fetch()` directly in a component.
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- **Tests**: every new service function and API endpoint needs at least one test before it's considered done.
- **Type safety**: no `any` in TypeScript without an inline comment explaining why; all Python functions need type hints (`mypy` enforced in CI).

## Commands

```bash
# Backend
cd backend
ruff check .              # lint
mypy app/                 # type check
pytest                    # run tests
uvicorn app.main:app --reload   # run dev server

# Frontend
cd frontend
npm run lint
npm run test
npm run dev

# Database
cd backend
alembic revision --autogenerate -m "description"   # create migration after model change
alembic upgrade head                                 # apply migrations
```

Run lint + tests before considering any change complete. CI will reject PRs that fail either.

## Things to never do

- Never commit `.env` files or hardcode secrets (Supabase keys, Sentry DSN, Resend API key) — they belong in environment variables only.
- Never bypass JWT verification on a protected route, even temporarily for testing — write a proper test fixture instead.
- Never add Android-specific code, native mobile dependencies, or React Native packages — this is a web-only project by explicit decision.
- Never introduce a new major dependency without noting it in `README.md`'s tech stack table.
- Never change an existing API response shape without updating the corresponding frontend types and checking for breaking usages.
- Never write business logic (budget calculations, correlation thresholds, PR detection) inside a route handler — it belongs in `services/`.
- Never skip writing a test for new service-layer logic, even if it feels trivial — the correlation engine and budget math are exactly the kind of "trivial" logic that breaks silently.

## Current milestone context

> Update this section as the project progresses — it should always reflect what's actively being built.

**Current release target: v0.1 (Weeks 1–4)**
Scope: Auth, Finance domain (transactions, categories, budgets, breach alerts), Steps domain (manual log + goal), dashboard skeleton, CI/CD pipeline live.

**Status (as of 2026-07-01):**
- Repo scaffolded end to end (frontend + backend + Docker + Alembic) and **deployed live**: backend on Render, frontend on Vercel, Postgres + Auth on Supabase. `backend-ci` and `frontend-ci` pass.
- First vertical slice proving the full chain works: `GET`/`PATCH /api/v1/auth/me` (JWT-verified, get-or-create `profiles`) wired to the dashboard's Supabase sign-in. Use it as the reference pattern for new domains.
- Up next in v0.1: build out the **Finance** and **Steps** domains (model → schema → service → route → test), then fill in the dashboard. (Auth + sign-up flow works but is still rough — polish later.)

**Deployment model (native, not a GitHub Actions job):**
- Render auto-deploys the backend on push to `main`; Vercel auto-deploys the frontend. There is **no `deploy.yml`** — don't re-add one.
- **Migrations are run manually** (`alembic upgrade head` against the prod DB) — nothing auto-migrates on deploy, so apply them yourself after any model change.
- `NEXT_PUBLIC_*` vars are baked at **build** time on Vercel; changing one requires a redeploy.

When asked to build a feature, check first whether it belongs to the current release scope (see [`DeveloperGuide.md` § Release Plan](./DeveloperGuide.md#14-release-plan)). If it's scoped for a later release, flag that before building it — scope creep across releases is the biggest risk to this project shipping on time.

## When in doubt

- Check `DeveloperGuide.md` first — it has the full schema, API conventions, and feature requirements.
- If a requirement is ambiguous, prefer the simpler implementation that's easy to extend later over a complex one that tries to predict future needs.
- This is a solo project built to also serve as a portfolio piece — code quality and test coverage matter as much as feature completeness.
