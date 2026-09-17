# Platform & Core

Everything that is not a tracking domain: authentication, the shell the domains live in, settings,
theming, and the pipeline that keeps it deployable.

- **Release:** v0.1 (most of it), ongoing
- **Scope names:** `auth`, `dashboard`, `api`, `db`, `ci`, `deps`
- **Code:** [`backend/app/core/`](../../backend/app/core/) ·
  [`backend/app/api/v1/auth.py`](../../backend/app/api/v1/auth.py) ·
  [`frontend/components/shared/`](../../frontend/components/shared/)

---

## Status

**Built:**

- **Auth** — Supabase email/password. The backend verifies every JWT against the project's JWKS
  endpoint using ES256; no auth data is duplicated locally.
- **Profiles** — a local `profiles` table keyed by the Supabase user id, holding app-specific
  fields: `timezone` and `display_currency`. `GET` and `PATCH /api/v1/auth/me`.
- **Auth guard** — signed-in routes live under `app/(app)/` and are wrapped by `AuthGuard`.
- **App shell** — sidebar navigation across the domains, plus profile and settings.
- **Dashboard** — currently a module index rather than per-domain summary widgets.
- **Theming** — every colour routed through theme tokens, with a picker in Settings and
  system-preference dark mode.
- **Health check** — `GET /api/v1/health`.
- **CI/CD** — lint, type-check, test, and build on every PR; auto-deploy on merge.
- **Error tracking** — Sentry on the backend.

**Not built:**

- Google OAuth sign-in. Email/password only today.
- Onboarding flow — the page is a placeholder.
- Dashboard summary widgets — the dashboard lists modules, it does not summarise them.
- Notification delivery of any kind. This blocks budget alerts, subscription reminders, and the
  weekly digest, and is why all three sit in v0.2 or later.
- Data export and account deletion.

---

## Auth

The flow, and the failure modes that matter:

1. The user signs in through the Supabase Auth SDK in the frontend.
2. Supabase issues a JWT.
3. The frontend sends it as a Bearer token on every backend request.
4. The backend verifies the signature against Supabase's published JWKS. No shared secret, no
   local auth table.

Rejections are uniform and deliberate:

| Situation | Response |
|---|---|
| No header, or not `Bearer` | `401 MISSING_TOKEN` |
| Bad signature, expired, wrong audience or issuer, unusable subject | `401 INVALID_TOKEN` |
| JWKS endpoint unreachable | `503 AUTH_UNAVAILABLE` |

All `401`s carry `WWW-Authenticate: Bearer`. The `503` exists because a JWKS outage must not look
to the client like a bad token — otherwise the frontend logs the user out over an upstream blip.

---

## Notifications

Not built, and three features depend on it: budget breach alerts, subscription renewal reminders,
and the weekly digest.

It is listed here rather than inside any one domain because building it three times, once per
feature, is the obvious failure mode. One delivery service, one preference surface, three callers.

**Required by v0.2** — subscription reminders are the first thing that needs it.

| Piece | Notes |
|---|---|
| Scheduler | Daily and weekly jobs. APScheduler in-process is likely enough for single-user scale; Celery only if that stops being true. |
| In-app | A notification record per user, marked read. The baseline every channel falls back to. |
| Email | Resend. Used for the weekly digest and opted-in reminders. |
| Preferences | Per-channel, per-category, on the profile. One place the user turns things off. |

Scheduled jobs on Render's free tier stop when the service spins down. Either the scheduler runs
somewhere that stays awake, or jobs are triggered by an external pinger and made idempotent so a
missed or repeated run is harmless. **Design the jobs to be idempotent regardless** — a reminder
that fires twice is a bug the user sees.

---

## Settings and onboarding

- **[v0.1, built]** Timezone and display currency.
- **[v0.1, built]** Colour scheme, including a system-preference default.
- **[v0.2]** Notification preferences, arriving with the notification service.
- **[v0.3]** Connected accounts — Google Calendar, and later Riot and Steam.
- **[v0.3]** Onboarding — domain selection and goal setup, under three minutes.
- **[Future]** Full data export as CSV or JSON, and account deletion.

---

## Observability

- **Structured logging** — JSON via structlog, so logs stay queryable if a log aggregator is ever added.
- **Sentry** — unhandled exceptions, both ends.
- **Health check** — `GET /api/v1/health`, used by Render and an uptime monitor.
- **Uptime monitoring** — UptimeRobot pinging the health check every 5 minutes.
- **[v0.4]** Per-endpoint latency logging, reviewed by hand. A full Prometheus and Grafana stack is
  overkill at this scale.

---

## CI/CD

Three workflows, no deploy workflow — Render and Vercel deploy natively on push to `main`.
Details in [`DeveloperGuide.md` § 9](../../DeveloperGuide.md#9-cicd-pipeline).

The one rule worth repeating here, because breaking it takes production down: **migrations do not
run themselves.** Render redeploys the instant a PR merges. Apply additive migrations to
production *before* merging the code that needs them, and split destructive changes across two
PRs, expand then contract.
