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
- **App shell** — navigation that adapts to the width: a sidebar with labels on desktops, an
  icon rail on tablets, and on phones a bottom tab bar (the first four modules plus **More**,
  which opens a drawer with every module). The header holds only what belongs to every module:
  a **Log** menu (one row per module that can log — Expense today), the notification bell, and
  the account menu (profile, settings, dark mode, log out).
- **Dashboard** — a Finance snapshot for the month, then the module index.
- **Theming** — every colour routed through theme tokens. Eight colour schemes, each only an
  accent on a neutral base, and Light / Dark / Match system, chosen in Settings and applied
  before first paint.
- **In-app notifications** — `notifications` table, `/api/v1/notifications`, a live bell in the
  header and a `/notifications` page; written by subscription reminders and renewal notices,
  currency notices and budget alerts. See [Notifications](#notifications).
- **Background jobs** — exchange-rate refresh, subscription renewals and reminders, and budget
  alerts, idempotent and triggerable over HTTP or the command line. See
  [Background jobs](#background-jobs).
- **Health check** — `GET /api/v1/health`.
- **CI/CD** — lint, type-check, test, and build on every PR; auto-deploy on merge.
- **Logs** — JSON lines in deployments, searchable by field. See [Observability](#observability).

**Not built:**

- Onboarding flow — the page is a placeholder.
- Dashboard summaries for the other modules — only Finance has a snapshot, since only Finance exists.
- Notifications in the Android app's tray — planned for v0.2, without server push. No email, by choice.
- The Android app — planned for v0.2. See [Android app](#android-app).
- Full data export and account deletion. (Finance's Transactions tab exports expenses to Excel;
  there is no whole-account export.)

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

Three features depend on it: subscription renewal reminders and budget breach alerts, both
built, and the weekly digest, still to come.

It is listed here rather than inside any one domain because building it three times, once per
feature, is the obvious failure mode. One delivery service, one preference surface, three callers.

| Piece | Status | Notes |
|---|---|---|
| In-app | **Built** | `notifications` table, one row per message. The baseline every channel falls back to. |
| Scheduler | **Built** | Supabase pg_cron + pg_net calling the job endpoints — see [Background jobs](#background-jobs). |
| Phone | Planned (v0.2) | The Android app's notification tray: server notifications fetched in the background, plus ones only the phone can raise. No server push. See [Phone notifications](#phone-notifications). |
| Email | Not planned | Dropped 2026-11-03: the weekly digest is in-app ([insights.md](./insights.md#delivery)), and the phone's tray covers reaching someone outside the app. |
| Preferences | Not built | Per-channel, per-category, on the profile. One place the user turns things off. |

`notifications` holds `user_id`, a `kind` (CHECKed string), `title`, `body`, an optional
`due_on` (the date the announced thing happens), `read_at`, `snoozed_at`, `archived_at`,
`alerted_at` (when it last asked for attention; lists are ordered by it), and a `dedupe_key`
unique per user, which is what makes a doubled or retried job run harmless.

Two families, with different lives:

| | Kinds | Text | Leaves the bell | Then |
|---|---|---|---|---|
| **Reminders** | `subscription_renewal`, `trial_ending` | Live: a daily countdown, rewritten by edits | Snoozed (`snoozed_at`) | Deleted on the charge day |
| **Notices** | `subscription_renewed`, `currency_delisted`, `budget_warning`, `budget_exceeded` | Fixed once sent | Moved to the history (`archived_at`) — by the user, or by the job once a currency or budget notice no longer applies | Kept until the user deletes them |

See [Subscriptions → Reminders](./finance.md#reminders) for when reminders are created,
rewritten and removed, and [Budget alerts](./finance.md#budget-alerts) for when a budget warns.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/notifications` | `?view=inbox` (default): neither snoozed nor archived. `?view=history`: snoozed or archived. Newest first; `?unread_only=true`, `?limit=` (1–100, default 50). |
| `PATCH` | `/notifications/{id}` | Exactly one of `{"read": bool}`, `{"snoozed": bool}` (reminders only) or `{"archived": true}` (notices only). Otherwise `422 WRONG_NOTIFICATION_KIND`. |
| `DELETE` | `/notifications/{id}` | Notices only. `204`. |

**Live updates.** The frontend shows the inbox behind a bell in the header, and the inbox and
history on `/notifications`. Both subscribe to **Supabase Realtime** on `notifications`, so a
job run, an edit in another tab or another device shows up without a reload. That needs row-level
security on the table with one policy — a signed-in user may `SELECT` their own rows — a `SELECT`
grant to `authenticated`, which the policy narrows to those rows, and the table in the
`supabase_realtime` publication; the migrations set all three up when they run on Supabase.
Without the grant, Realtime answers every change with "401 Unauthorized" and the bell only
catches up on refetch — the case until `23a0df7e12fb`. The backend connects as the table owner, which RLS does not restrict. Refetching on tab
focus and every five minutes covers a dropped socket. The Android app subscribes the same way
while it is open, and refetches when it returns to the foreground.

### Phone notifications

*Planned for v0.2, with the Android app.* Notifications reach the phone's tray **without server
push** — no Firebase, no push service, no table of device tokens, no outbound call from the
backend. Each kind of notification has exactly one path to the tray, so none arrives twice.

**Server notifications are fetched.** Everything the jobs write to `notifications` — reminders,
renewal notices, budget alerts, currency notices, step replacements, calendar conflicts, the
weekly digest:

- The background task that already runs for steps and screen time, about hourly, also asks
  `GET /notifications?alerted_after=<newest it has shown>` and shows each new row as a local
  notification, in full text. While the app is open, Realtime keeps it current, as on the web.
- **Reminders are scheduled ahead, so they fire offline.** A reminder row becomes one scheduled
  notification per remaining day until its `due_on`, at 09:00 local — "renews in 3 days", then 2,
  then 1 — each replacing the last in the tray.
- **Every successful sync rebuilds the schedule rather than patching it.** The app cancels
  everything it scheduled from server rows and schedules again from the current list, and
  removes from the tray any notification whose row is gone, read, snoozed or archived. So
  cancelling a subscription on the web, or reading or snoozing a reminder there, clears it from
  the phone at its next sync.
- **The phone schedules from the server's rows, not from subscriptions' billing dates.** The
  server stays the one place that decides what to remind about, and the billing-date rules are
  not written a second time in TypeScript. It only needs the phone to sync once in the three days
  before a charge.
- **The one gap is a phone that stays offline.** If a subscription is cancelled on the web and
  the phone hears nothing before the reminder's time, the reminder fires anyway. No design closes
  this — a server push would not reach an offline phone either — and a stale reminder costs a
  tap, where a missed renewal costs money. Tapping it opens the subscription: refreshed if the
  phone is online, otherwise the cached copy, labelled with when it was last synced.

**Phone notifications are local.** What the phone measures or schedules itself:

- **Entertainment allowance at 80% and at its cap**, from screen time the phone measures —
  raised while the user is still in the app that crossed it, not an hour later. The server
  writes the same alert for the web's bell, and the fetch path skips that kind, so the phone
  shows it once.
- **The focus timer**: an ongoing notification while it runs, and one when it ends.
- **Habit reminders and mood / sleep check-in prompts** (v0.3), at the time the user set.
  Android 14 denies exact alarms by default, so they may arrive a few minutes late; to the
  minute would need the exact-alarm permission.
- **Offline sync trouble**: a queued write the server refused, or a clash waiting for an answer
  (see [Offline on Android](#offline-on-android)).

Tapping any notification opens its subject — a budget alert opens that budget, a replaced step
count that day. Android channels — Reminders, Notices, Timer, Sync — let the user mute one in
Android's own settings without losing the others. The notification permission is asked for
after sign-in, with one line saying why.

**What the backend needs:** `GET /notifications` gains `?alerted_after=`, so the app fetches
only what is new. Nothing else.

**Cost: a server notification can lag.** It reaches the tray at the phone's next background run
— up to about two hours after the job writes it (the job and the fetch each run about hourly),
longer on a phone whose battery saver stops the app. Nothing the app sends is more urgent than
that. Server push stays possible later, for a feature that needs instant delivery (something
shared between users, say): it would read the same table, so adding it changes nothing else.

### Background jobs

| Job | What it does | Cadence |
|---|---|---|
| `exchange-rates` | Fetch rates from the upstream into `exchange_rates`, delist currencies it dropped, and notify their users. The table's only writer. | Daily. |
| `subscriptions` | Record charges that have come due as expenses (the renewal job), then create, re-count and clean up reminders. | Every 2 hours: each user's daily countdown then changes within 2 hours of their midnight. |
| `budgets` | Alert on budgets that reached their early warning or their cap, and move alerts that no longer apply to the history. | Hourly, at half past: an overspend is announced within the hour, and renewals logged on the hour are counted. |

The jobs live in [`app/tasks/jobs.py`](../../backend/app/tasks/jobs.py) as plain async functions,
and every trigger calls the same ones:

- **HTTP** — `POST /api/v1/tasks/<job>` with an `X-Task-Secret` header matching `TASK_SECRET`.
  For a GitHub Actions cron, Supabase `pg_cron` + `pg_net`, or an external pinger. With
  `TASK_SECRET` unset the endpoints answer `503 TASKS_DISABLED`.
- **Command line** — `python -m app.tasks <job>`, for a Render cron job or anything else that
  runs a command with `DATABASE_URL` set. Exits non-zero on failure.
- **In-process** — an APScheduler (or similar) can call the functions directly.

**Production uses Supabase `pg_cron` + `pg_net`**, set up by
[`backend/scripts/schedule_jobs.sql`](../../backend/scripts/schedule_jobs.sql): run it once in the
Supabase SQL editor after deploying, with the Render URL and `TASK_SECRET` filled in. Both are
kept in Supabase Vault, not in the job definitions, and the script is safe to re-run. Its last
section has the queries for checking that runs fire and what the backend answered.

Scheduled jobs on Render's free tier stop when the service spins down, which is why the jobs do not
assume they run on time. **Keep new jobs idempotent** — a charge recorded twice is a bug the user
sees.

---

## Settings and onboarding

- **[v0.1, built]** Timezone. It follows the browser: it is
  synced to the profile silently on each signed-in page load, so server-side work (subscription
  scheduling, renewals and reminders) uses wherever the user is now.
- **[v0.1, built]** Appearance: eight colour schemes and Light / Dark / Match system (the
  default), with a quick dark-mode switch in the account menu.
- **[v0.1, built]** Currencies: display currency (what totals are reported in) and preferred
  currency (what new entries start in).
- **[v0.2]** Notification preferences, arriving with the notification service — per channel
  (in-app, phone) and per category.
- **[v0.3]** Connected accounts — Google Calendar, and later Riot and Steam.
- **[v0.3]** Onboarding — domain selection and goal setup, under three minutes.
- **[Future]** Full data export as CSV or JSON, and account deletion.

---

## Android app

*Planned for v0.2.* A second client of the same backend, at parity with the web, adding what
only a phone can do. Decision and stack: [ADR-0004](../adr/0004-android-app-as-second-client.md).

- **Where it lives.** `mobile/`, a top-level folder beside `frontend/`. Not `android/`: Expo
  generates a folder of that name inside the app.
- **Identity.** Package name `com.tuanduong.ultimatetracker`, shown on the home screen as
  **Ultimate Tracker**. The package name is permanent — changing it makes a different app,
  which every phone would have to uninstall and reinstall — so it is fixed here before the
  first build.
- **Android 14 or later.** Every user is on a current Android, so the floor is set where
  Health Connect, for those who switch it on, is part of the system rather than a separate app
  from the Play Store: one permission flow to build and test, not two. The reference device is
  a **Xiaomi Redmi Note 13 Pro 5G** on HyperOS.
- **Permissions, asked when they are needed and each with one line saying why:** notifications
  after sign-in; *physical activity* for the step counter; **Usage access** for screen time and
  sleep, granted by hand in Settings (see [Screen time](./time-and-calendar.md#screen-time)).
  Health Connect's own permissions only if the user switches it on
  ([fitness.md](./fitness.md#health-connect)).
- **Sign-in.** The same Supabase project and providers. Email and password as on the web; Google
  through the system browser with PKCE, returning to `ultimatetracker://auth/callback`, which
  has to be added to Supabase's Redirect URLs beside the web origins. The session is kept in
  `expo-secure-store`.
- **Shell.** The web's phone layout is the starting point: a bottom tab bar with the first four
  modules plus **More**, and a header with Log, the notification bell and the account menu. It
  follows Android's own conventions where they differ — the system back gesture, edge-to-edge
  drawing, 48 dp touch targets.
- **Timezone** follows the device and syncs to the profile on launch, as the web does in the
  browser.
- **Background work** — reading steps, screen time and sleep, fetching notifications and sending the
  offline outbox — runs on WorkManager through
  `expo-background-task`: about hourly, best-effort, and delayed further by some phone makers'
  battery savers. Every sync it calls is an idempotent batch upsert, so a late or repeated run
  only catches up. The app shows when each sync last succeeded.
- **Xiaomi's battery saver is the one to beat.** HyperOS stops background work for apps it has
  not been told to leave alone, which on the reference device means syncs that never run. The
  app's setup screen walks through the two switches it needs — **Autostart** on, and **Battery
  saver → No restrictions** — and the sync status shows the gap when they are off, rather than
  leaving a stale step count looking current.
- **Notifications.** See [Phone notifications](#phone-notifications).
- **Offline.** See [Offline on Android](#offline-on-android).
- **No crash reporting yet.** As on the web, there is no error-reporting service for now; the
  app shows when each sync last succeeded. Sentry for the Android app — readable traces through
  uploaded source maps, native crashes, personal data stripped — is planned for the last
  development phase.
- **Distribution.** A signed APK, sideloaded — no store listing, no AAB. EAS Build makes it, a
  GitHub Release hosts it, and EAS Update ships JavaScript-only changes to installed apps on
  their next launch. A new APK is needed only when native code or permissions change; the app
  checks the latest GitHub Release and offers it.
- **Developer verification: not registered, for now.** Since 30 September 2026, apps installed
  on certified Android devices in Singapore (and Brazil, Indonesia and Thailand; globally from
  2027) must come from a verified developer — or the phone's owner opts in to unverified ones.
  The app takes the second route: the APK is sent as a file, and each user, once per phone,
  turns on **Developer options → Apps from unverified developers** (Google's "advanced flow",
  which makes them wait 24 hours and click through warnings) or installs over `adb` from a
  computer. EAS Update's over-the-air updates do not go through the installer, so most releases
  are unaffected. If that first install becomes a nuisance, a free **limited distribution
  account** in the Android Developer Console (up to 20 devices, no fee, no ID) registers the
  package and its signing key, and the step goes away. The rules shifted through 2026; check
  developer.android.com before relying on any detail here.
- **Signing key.** Managed by EAS and backed up. Losing it forces every user to uninstall and
  reinstall; their data lives on the server and survives.

### Offline on Android

*Planned for v0.2, built into the Android app's parity work from the start.* Logging happens on
the move — on a train, in a basement food court — so the app must accept a write with no
signal and deliver it later. The web stays online-only.

- **Reads come from a cache.** TanStack Query's cache is persisted on the device, so every screen
  shows what it last loaded, marked with when that was, instead of an error.
- **Writes go through an outbox.** Every create, edit and delete is written to a persisted queue
  on the device first and shown at once, marked *waiting to sync*. The queue is sent in order as
  soon as the phone is online, and by the background task. Building every form on it from the
  first parity screen is cheaper than retrofitting it into each one later.
- **Replays are idempotent.** A create carries a client-generated UUID as the new row's id, so a
  replay of a create the server already applied returns that row instead of making a second
  one. A delete of a row that is already gone counts as done.
- **Edits are checked per field.** An edit sends only the fields it changed, each with the value
  it was changed from. The server applies it if those fields still hold those values, whatever
  happened to the rest of the row, and otherwise answers `409 EDIT_CONFLICT` with the current
  row. Fields that only mean something together — a budget's `all_spending` and its categories
  — are checked as one. So a phone edit of an expense's amount and a web edit of its category
  both stand, and a subscription edited offline is not a clash just because the renewal job moved
  its billing date. A delete carries the row as the phone last saw it, checked the same way.
- **A real clash is the user's call.** Both versions are kept until the user answers, from a
  **Needs your attention** list, with a local notification pointing to it. Until then the phone
  shows its version marked as clashing, and the web shows the server's.
- **A rejected write is kept, not lost.** If the server refuses a queued write for a reason the
  phone could not see — the category was deleted, the currency was delisted — it stays in the
  outbox, flagged, until the user fixes or discards it.
- **Some things stay online-only.** Anything whose answer only the server can give: spreadsheet
  import and export, and the converted totals on the dashboard, which show their last cached
  figures until the phone reconnects.

Every case, phone against web:

| The phone, offline | The web, meanwhile | When the phone comes back online |
|---|---|---|
| Edited a row | Edited other fields of it | Both kept. No question. |
| Edited a field | Edited the same field to a different value | Asked: the phone's value or the web's? |
| Edited a row | Deleted it | Asked: restore it with the edit, or let it go? |
| Deleted a row | Edited it | Asked: delete anyway, or keep the web's version? |
| Deleted a row | Deleted it | Done. |
| Created an entry | Created the same entry | Both kept. No duplicate detection: it is rare, and the duplicate is in plain sight. |
| Created an entry in category X | Deleted category X | Refused, and kept in the outbox, flagged, until the user picks another category or none. |
| Created a category, then entries in it | — | Works: the entries point at the category's phone-made id, and the queue sends the category first. |
| Renewed a subscription early | The renewal job recorded that charge | Checked at replay: nothing new is recorded, and the phone says it was already renewed. |

**Last write wins was rejected.** It decides by which write reached the server last — after
hours offline, by when the train left the tunnel — and drops the other edit without telling
anyone.

**What the backend needs for it:** create endpoints that accept an optional client-supplied
`id`, treating a repeat by the same user as a no-op; edit and delete endpoints that take the
original values of the fields they touch and answer `409 EDIT_CONFLICT`, with the current row,
when any has changed. No new columns: the check compares values, not timestamps.

---

## Observability

- **Structured logging** *(built)* — structlog, configured at start-up
  ([`app/core/observability.py`](../../backend/app/core/observability.py)): one JSON object
  per line when `ENVIRONMENT` is a deployment (`production` on Render), readable text in
  `development`. Fields stay fields, so the logs are searchable by them.
- **No error-reporting service** *(by choice)* — the users are the author and a few
  friends, who see failures on screen. Failed scheduled jobs show up as `level: error`
  log lines and in pg_cron's run history.
- **Health check** — `GET /api/v1/health`, used by Render and an uptime monitor. Always `200`;
  the body says `"db": "connected"` or `"disconnected"`.
- **Uptime monitoring** — UptimeRobot pinging the health check every 5 minutes.
- **[v0.4]** Per-endpoint latency logging, reviewed by hand. A full Prometheus and Grafana stack is
  overkill at this scale.

---

## CI/CD

Three workflows, no deploy workflow — Render and Vercel deploy natively on push to `main`.
Details in [`DeveloperGuide.md` § 9](../../DeveloperGuide.md#9-cicd-pipeline). A fourth,
`mobile-ci`, arrives with the Android app.

The one rule worth repeating here, because breaking it takes production down: **migrations do not
run themselves.** Render redeploys the instant a PR merges. Apply additive migrations to
production *before* merging the code that needs them, and split destructive changes across two
PRs, expand then contract.
