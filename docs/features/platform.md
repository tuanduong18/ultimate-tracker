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
  fields: `display_name`, `timezone`, `display_currency` (what totals are reported in) and
  `preferred_currency` (what new entries start in). `GET` and `PATCH /api/v1/auth/me`. The email
  is deliberately not copied: the frontend reads it from the Supabase session. With no
  `display_name`, the UI falls back to the name the sign-in provider supplied, then the email.
- **Sign-in** — email and password, or Google OAuth through Supabase. See
  [Google sign-in setup](#google-sign-in-setup).
- **Welcome page** — the public `/`: what the app does today, every module with its release, and
  sign-up / log-in calls to action (one "Open dashboard" button for a signed-in visitor).
- **Auth guard** — signed-in routes live under `app/(app)/` and are wrapped by `AuthGuard`.
- **App shell** — navigation that adapts to the width: a sidebar on desktops, an icon rail on
  tablets, and a menu button with a slide-out drawer on phones. Profile, settings and log out
  live in an account menu behind the avatar, top right, at every width.
- **Dashboard** — currently a module index rather than per-domain summary widgets.
- **Theming** — every colour routed through theme tokens, with a picker in Settings and
  system-preference dark mode.
- **Health check** — `GET /api/v1/health`.
- **CI/CD** — lint, type-check, test, and build on every PR; auto-deploy on merge.
- **Error tracking** — Sentry on the backend.

**Not built:**

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

## Google sign-in setup

The code is provider-agnostic; turning Google on is configuration in two consoles.

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID*
   (type *Web application*). Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Configure the consent screen
   (app name, support email) if prompted.
2. **Supabase** → Authentication → Sign In / Providers → *Google*: enable it and paste the client
   ID and secret.
3. **Supabase** → Authentication → URL Configuration → *Redirect URLs*: add
   `http://localhost:3000/**` and the production origin followed by `/**`. The app sends users
   back to `/login?next=…`, and Supabase refuses any redirect not on this list.

A Google account whose verified email matches an existing email-and-password account is linked
to it by Supabase — same user id, so the same profile and data.

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

- **[v0.1, built]** Timezone and display currency. The timezone follows the browser: it is
  synced to the profile silently on each signed-in page load, so server-side work (subscription
  scheduling, renewals and reminders) uses wherever the user is now.
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
