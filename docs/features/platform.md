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

- **Auth** — Supabase email/password and Google, **open to anyone**: the app is meant to be
  tried, so anyone can sign up and email sign-ups confirm their address first. The backend
  verifies every JWT against the project's JWKS endpoint using ES256; no auth data is duplicated
  locally.
- **Profiles** — a local `profiles` table keyed by the Supabase user id, holding app-specific
  fields: `display_name`, `timezone`, `display_currency` (what totals are reported in),
  `preferred_currency` (what new entries start in), `muted_notifications`
  ([Notification preferences](#notification-preferences)) and `chart_hidden_categories`
  ([finance.md](./finance.md#the-charts-starting-categories)). `GET` and `PATCH /api/v1/auth/me`; a
  `timezone` that is not an IANA name ("Asia/Singapore") is refused with 422, since every
  scheduled job reads it to find the user's today. The email
  is deliberately not copied: the frontend reads it from the Supabase session. With no
  `display_name`, the UI falls back to the name the sign-in provider supplied, then the email.
- **Sign-in** — email and password, or Google OAuth through Supabase with **PKCE** on both
  clients: the redirect back carries a one-time code, never the tokens. After logging in,
  `?next=` is followed only to a page of this app (`lib/safe-next.ts`). See
  [Google sign-in setup](#google-sign-in-setup).
- **Welcome page** — the public `/`: what the app does today, every module with its release, and
  sign-up / log-in calls to action (one "Open dashboard" button for a signed-in visitor).
- **Web security headers** — a Content-Security-Policy with a fresh nonce per page
  (`frontend/proxy.ts`): only scripts carrying it run, and pages talk only to the site, the API and
  Supabase. Every response also gets `nosniff`, `X-Frame-Options: DENY`, a referrer policy that
  sends only the origin, and a Permissions-Policy turning off camera, microphone, location and
  payment (`next.config.mjs`). The nonce makes every page render on request.
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
- **Notification preferences** — one switch per category, kept on the profile, on the web's
  Settings and in the Android app. See [Notification preferences](#notification-preferences).
- **Phone notifications** — the Android app's tray, without server push: notices fetched, hourly
  in the background, and reminders scheduled ahead; four channels; background sync with the
  Xiaomi setup screen; the new-version check. See [Phone notifications](#phone-notifications).
- **Background jobs** — exchange-rate refresh, subscription renewals and reminders, and budget
  alerts, idempotent and triggerable over HTTP or the command line. See
  [Background jobs](#background-jobs).
- **Health check** — `GET /api/v1/health`.
- **CI/CD** — lint, type-check, test, and build on every PR; auto-deploy on merge.
- **Logs** — JSON lines in deployments, searchable by field. See [Observability](#observability).

**Not built:**

- Onboarding flow — the page is a placeholder.
- Dashboard summaries for the other modules — only Finance has a snapshot, since only Finance exists.
- The Android app's first release: the APK on a GitHub Release and the over-the-air update
  channel (see [Android app](#android-app), "Distribution"). The app's side — the update
  library, the new-version check — is built. No email, by choice; no offline mode, by choice
  ([Offline on Android](#offline-on-android)).
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
4. **For the Android app**, on the same list: `ultimatetracker://**`, the app's link scheme. The
   app uses the same Google client: the browser signs in with Supabase exactly as the web does,
   and only the last redirect goes to the app instead of a page, so Google Cloud needs no Android
   client. (`exp://**`, Expo Go's scheme, isn't needed: Google sign-in stalls in Expo Go after the
   account is chosen even with it on the list, and works on the development build.)

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
| In-app | **Built** | `notifications` table, one row per message. The baseline every channel falls back to. On the web: the bell and `/notifications`. On Android: the bell in each tab's top bar and the Notifications screen. |
| Scheduler | **Built** | Supabase pg_cron + pg_net calling the job endpoints — see [Background jobs](#background-jobs). |
| Phone | **Built** | The Android app's notification tray: server notifications fetched in the background, reminders scheduled ahead, plus ones only the phone can raise, each in its category's Android channel. No server push. See [Phone notifications](#phone-notifications). |
| Email | Not planned | Dropped 2026-11-03: the weekly digest is in-app ([insights.md](./insights.md#delivery)), and the phone's tray covers reaching someone outside the app. |
| Preferences | **Built** | One switch per [category](#notification-categories), on the profile, so it holds on every device; the phone's tray per category in Android's own settings. See [Notification preferences](#notification-preferences). |

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
focus and every five minutes covers a dropped socket. The Android app *(built)* subscribes the
same way while it is open — one channel under the tabs, shared by every bell — polls the inbox
every five minutes, and refetches when it returns to the foreground.

### Notification categories

Every kind belongs to one
category. A category is what a person turns off — in the app's Settings, and on the phone as an
Android channel of the same name — so both places use the same words.

| Category | `id` | Kinds | Can be turned off |
|---|---|---|---|
| Subscription reminders | `subscription_reminders` | `subscription_renewal`, `trial_ending` | Yes |
| Renewals | `subscription_renewals` | `subscription_renewed` | Yes |
| Budget alerts | `budget_alerts` | `budget_warning`, `budget_exceeded` | Yes |
| Currency notices | `currency_notices` | `currency_delisted` | No: a delisted currency means a total that can't be converted until the person changes it |

A new kind joins a category in the PR that adds it, on the backend and in both clients; a
module's first kind usually brings a category of its own. The backend keeps the kind → category
map beside `REMINDER_KINDS` in `app/models/notification.py`, with a test that every kind has
one; the phone's map is typed so that an unmapped kind fails the type check. An installed app
that meets a kind it doesn't know — an older APK, after the server gained one — skips it in the
tray and still shows it in the bell.

### Notification preferences

*Built.* One switch per category that can be turned off, kept on the account, so it
holds on every device.

- **Stored on the profile** as `muted_notifications`: the ids of the categories turned off, an
  array, empty by default. Storing what is off means everything starts on, and a new category
  needs no migration. `GET /auth/me` returns it; `PATCH /auth/me` replaces it whole. Only the
  three categories that can be turned off are accepted; anything else is `422 VALIDATION_ERROR`.
  When two devices change the switches at the same moment, the last save wins.
- **A muted category is not written.** The jobs, and the subscription edits that rewrite
  reminders, skip its kinds — so the bell, the history and the phone's tray all go without them.
- **A muted renewal still records its expense.** The switch silences the notice, never the charge.
- **Turning Subscription reminders off deletes the live reminders** in the same request; they
  would otherwise sit in the bell for up to three days.
- **Notices already sent stay.** Budget alerts in the inbox still move to the history when they
  stop applying.
- **Turning a category back on catches up only on what still applies.** Reminders return at the
  next `subscriptions` run, within two hours; a budget already past a threshold is announced at
  the next `budgets` run. Renewals recorded while Renewals was off are not announced afterwards:
  the expense is in Transactions.
- **On the web**, Settings gains a **Notifications** section after Appearance: the three
  switches, each with one line saying what it covers, "These apply on every device", and a line
  saying currency notices always arrive. The page's description stops saying "on this device",
  since this section follows the account. A switch applies at once, as Appearance does; if saving
  fails it flips back and says so.
- **On the phone**, More → Settings → Notifications has the same three switches in the same
  words, then **On this phone**: whether Android lets the app notify at all, and each channel as
  Android has it ("On" or "Off in Android settings"), each row opening that channel's page in
  Android's settings. The phone keeps no tray switch of its own: Android's is the one switch, so
  the two can never disagree. A switch applies at once; if saving fails it flips back and says
  so, as on the web. Without a connection it fails at once rather than waiting on screen as the
  app's other saves do ([Offline on Android](#offline-on-android)): a switch that looks flipped
  while nothing has been saved would mislead.

### Phone notifications

*Built.* Notifications reach the phone's tray **without server
push** — no Firebase, no push service, no table of device tokens, no outbound call from the
backend. Each kind of notification has exactly one path to the tray, so none arrives twice.
Local notifications need no Firebase at all: `expo-notifications` declares a Firebase service,
which stays idle without a `google-services.json`.

**Server notifications are fetched.** A sync runs at launch, whenever the app returns to the
front, on every background run (see **Background sync** under [Android app](#android-app)), on a
pull to refresh of the Notifications screen, and whenever the inbox changes while the app is
open — Realtime, or a save on the phone that rewrote a reminder. It reads the inbox —
`GET /notifications?view=inbox&limit=100`, the bell's own request — and:

- **shows each unread notice it has not shown before** — an `alerted_at` newer than the newest
  it has shown — as a local notification, in full text, in its category's channel. A notice
  already read on another device is skipped. The phone keeps that mark per signed-in person, and
  the first sync after signing in sets it to the newest row without showing anything: what is
  already in the inbox is in the bell, and a flood of old notices helps no one. While the app is
  open, new rows go to the bell instead, as on the web, and count as shown.
- **schedules each live reminder for 09:00 local**, never at fetch time: the server rewrites
  reminders around midnight, which is no time to ring. One notification per remaining day until
  `due_on`. A day whose 09:00 has passed shows at once only if the reminder is unread and the
  phone has neither shown nor scheduled that day: it keeps, for each live reminder, the last day
  it has handled. So today's reminder, swiped away, stays away until tomorrow's — without the
  mark every sync would bring it back, since a notification swiped away and one never shown look
  the same to the app. Each day's title is the row's with its countdown swapped for that day's
  — "renews in 2 days", "renews tomorrow" — in the server's words from `_when` in
  `services/finance/reminders.py`, a twin kept in step with it. Today's is worked out the same
  way, so a sync just after midnight, before the server has rewritten the row, still says the
  right thing.
- **rebuilds rather than patches**, and only once the inbox has loaded: a sync that can't reach
  the server leaves everything as it was. It cancels everything it scheduled from server rows and
  schedules again from the current inbox; it removes from the tray every notification whose row
  is gone, read, snoozed or archived, and puts the new words in place of any whose row now reads
  differently, without ringing again: an edit, usually the person's own, is not news. So
  cancelling a subscription on the web, or reading or snoozing a reminder there, clears it from
  the phone at its next sync. *To confirm on the reference phone before it is built:* if Android
  rings on every replacement, an entry already in the tray keeps its words and only the days
  still to come change.

**How the phone finds its own notifications again.** Nothing is stored to find them, on the
server or on the phone. Each local notification's id is built from its server row's id —
`notification:<row id>` for a notice, `reminder:<row id>:<YYYY-MM-DD>` for each day of a reminder
— and carries the row's id in its data. Android keeps what is scheduled and what is in the tray,
and the app lists both (`getAllScheduledNotificationsAsync`, `getPresentedNotificationsAsync`), so
a rebuild cancels every scheduled one whose id starts with those prefixes and checks every tray
entry against the rows it just loaded. The server doesn't keep the phone's ids: they exist only
on that phone, only the phone can cancel them, they would go stale on a reinstall, and a table of
them per device is the device registry this design avoids.

**What the phone does keep** is two small marks per signed-in person, forgotten at log out: the
newest notice it has shown, and the last day handled for each live reminder, dropped when the
reminder leaves the inbox.

For example: a subscription added on the phone renews in two days, so its reminder row is
written with it, and the phone schedules 09:00 tomorrow and 09:00 the day after. The wifi goes
off and the app is closed. Meanwhile the amount is changed on the web, which rewrites that
reminder row in place — same id, new words. (A new charge date would delete the row and write a
new one; cancelling the subscription would delete it.) The next time the app opens with a
connection, or the background sync runs, the rebuild cancels both scheduled days and schedules
them again from the row as it is now; a deleted row leaves nothing scheduled, and nothing in the
tray. Until then, a phone still offline at 09:00 shows the old words — the one gap below.

No new endpoint: one person's inbox is small, ordered by `alerted_at`, and the rebuild needs all
of it anyway. The earlier plan's `?alerted_after=` was dropped on 2026-11-12 for that reason.

- **The phone schedules from the server's rows, not from subscriptions' billing dates.** The
  server stays the one place that decides what to remind about, and the billing-date rules are
  not written a second time in TypeScript. It only needs the phone to sync once in the three days
  before a charge.
- **A countdown's days are separate tray entries.** Android keys a tray entry by its
  notification's id, and one id holds one future notification, so days scheduled ahead can't
  replace each other: a phone that stays offline can show "renews in 2 days" beside "renews
  tomorrow" until a sync clears the older one — within the hour on a connected phone.
- **The one gap is a phone that stays offline.** If a subscription is cancelled on the web and
  the phone hears nothing before the reminder's time, the reminder fires anyway. No design closes
  this — a server push would not reach an offline phone either — and a stale reminder costs a
  tap, where a missed renewal costs money. Tapping it opens Subscriptions, which shows the
  current list once the phone is back online.
- **A restart.** Android forgets scheduled notifications when the phone restarts. The library
  sets them again as the phone starts up, which HyperOS allows only with Autostart on; without
  it they return at the next sync.
- **A force stop.** Android cancels an app's scheduled notifications when it is force-stopped,
  and HyperOS's "clear all" can act as one: nothing fires until the app is next opened, when the
  sync sets them again. The setup screen says not to force-stop the app. *To confirm on the
  reference phone.*

**Phone notifications are local.** What the phone measures or schedules itself:

- **Entertainment allowance at 80% and at its cap** *(v0.2, with screen time)*, from screen time
  the phone measures — raised while the user is still in the app that crossed it, not an hour
  later. The server writes the same alert for the web's bell, and the fetch path skips that kind,
  so the phone shows it once.
- **The focus timer** *(v0.2, with the timer)*: an ongoing notification while it runs, and one
  when it ends.
- **Habit reminders and mood / sleep check-in prompts** (v0.3), at the time the user set.
  Android 14 denies exact alarms by default, so they may arrive a few minutes late; to the
  minute would need the exact-alarm permission. Reminders at 09:00 have the same slack.

**Channels.** Every notification goes to one of a fixed set of Android channels, so the person
can silence one kind of message in Android's settings without losing the others. The channels sit
in one group per module, as the app's navigation does.

| Group | Channel | `id` | Carries | Importance |
|---|---|---|---|---|
| Finance | Subscription reminders | `subscription_reminders` | renewal and trial reminders | Default: a sound, no pop-up |
| Finance | Renewals | `subscription_renewals` | renewal notices | Low: silent, in the shade — a receipt |
| Finance | Budget alerts | `budget_alerts` | early warnings and caps | Default |
| Finance | Currency notices | `currency_notices` | delisted currencies | Default |

- **The set is defined once, in code, and created at launch**, before anything is scheduled; a
  channel or group not in it is deleted. Nothing makes a channel id from data — a channel per
  subscription or per notification is the classic mistake: it fills Android's settings with
  entries, and muting one does nothing for the next. The one function that sends takes a channel
  from the set, never a string. A notification sent with no channel, or with one not yet
  created, lands in a "Miscellaneous" channel the library makes for it at high importance, which
  pops up on screen.
- **A channel's settings belong to the person once it exists.** The app can still change its name
  and description, nothing else. So ids name a purpose and never change: changing a channel's
  sound or importance would take a new id, and Android then lists the old one as a deleted
  category.
- **A notification's own id is its server row's** (or, for a reminder, the row's and the day's),
  and that is what replaces, cancels or clears one tray entry — never the channel.
- **A channel arrives with the feature that first sends to it**: Timer with the focus timer, a
  Fitness group with Fitness.
- **No quiet hours of the app's own.** A budget alert written at night rings unless the phone is
  on Do Not Disturb, which is the person's one switch for that; renewal notices are silent by
  their channel.

Tapping any notification opens its subject — a reminder opens Subscriptions, a renewal notice
Transactions, a budget alert Budgets, a currency notice Profile — and marks its row read, as
opening the inbox does. Swiping one away does neither: the row stays unread in the bell. Tapped
while signed out, it leads to sign-in and then the dashboard, not the subject: rare, and not
worth carrying a destination through sign-in. The notification permission is asked for once, after sign-in, with one line saying
why. Refused, nothing else changes: the bell still works, and Settings → Notifications says the
tray is off and opens Android's settings. **Logging out** cancels everything scheduled, clears
the tray and forgets what was shown, so the next person to sign in on that phone never gets the
last one's reminders. Tray text includes amounts ("USD 15.49 will be charged on …"); whether a
locked screen shows it is the phone's own setting for sensitive notifications, which the
channels leave in charge.

**What the backend needs:** nothing for the tray. Notification preferences add one column (see
[Notification preferences](#notification-preferences)).

**Cost: a server notification can lag.** It reaches the tray at the phone's next background run
— up to about two hours after the job writes it (the job and the fetch each run about hourly),
longer on a phone whose battery saver stops the app. Nothing the app sends is more urgent than
that. Server push stays possible later, for a feature that needs instant delivery (something
shared between users, say): it would read the same table, so adding it changes nothing else.

On a phone whose maker stops background runs altogether — HyperOS with Autostart off, and on
some phones an app swiped out of recents — notices reach the tray when the app is next opened,
and reminders already scheduled still fire on time. That is accepted, and no reason for server
push.

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
- **[v0.2, built]** Notification preferences — one switch per category, on the account, on both
  clients; the phone's tray per category in Android's own settings. See
  [Notification preferences](#notification-preferences).
- **[v0.3]** Connected accounts — Google Calendar, and later Riot and Steam.
- **[v0.3]** Onboarding — domain selection and goal setup, under three minutes.
- **[Future]** Full data export as CSV or JSON, and account deletion.

---

## Android app

*v0.2.* A second client of the same backend, at parity with the web, adding what only a phone
can do. **At parity since 2026-11-11**: everything the web does, the app does too; what remains
is what only a phone can do — tray notifications, then steps and screen time. Decision and stack: [ADR-0004](../adr/0004-android-app-as-second-client.md).

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
- **Sign-in** *(built)*. The same Supabase project, providers and words as the web: Log in and
  Sign up with email and password, and Continue with Google. Google opens in the system browser
  (Custom Tabs, so the user's own Google session and password manager) using **PKCE** — the
  redirect carries only a one-time code, exchanged once by the app — and returns to
  `auth/callback` on the app's link scheme, which must be on Supabase's Redirect URLs
  ([setup](#google-sign-in-setup)). A sign-up confirmation email links back into the app too, so
  opening it on the phone confirms and signs in at once; opened elsewhere it still confirms, and
  Log in works after. The session is kept in Android's encrypted storage (`expo-secure-store`),
  split into chunks because a session is larger than one stored value may be. Signed-out users
  only ever see Log in and Sign up; the splash screen stays up until the stored session has been
  read, so the tabs never flash. A 401 from the API logs out, as on the web. Sign-in failures are
  shown in plain words rather than the auth server's ("That email and password don't match an
  account"); the web still shows the server's message.
- **Shell** *(built)*. The web's phone layout, in Android's own parts: Material bottom
  navigation with the first four modules plus **More**, labels always shown; each tab a native
  stack whose top app bar carries the screen's title. **More is a screen, not a drawer** — a
  drawer fights the system back gesture — listing the remaining modules and the account (the
  person, opening their **Profile**, then **Settings** and **Log out** — on the web all of these
  live in the account menu), with the app's version at its foot — and, once an over-the-air
  update is running, that update's date, so "which version do you have?" stays
  answerable. **Log and the bell** *(built)* sit on the right of each tab's first screen — the web
  header's two global actions; pushed screens keep their bar for their own actions. Log opens a
  bottom sheet with a row per module that can log (Expense today), each opening its form. The
  bell shows the inbox's unread count and opens **Notifications** *(built)* above the tabs: the
  inbox, then the history, with the web's actions in its words (Snooze / Unsnooze, Got it / Move
  to history, Delete after Android's confirm dialog) and a link to what each is about. Opening it
  marks the inbox read, as opening the web's panel does. A module not built yet says when it
  lands and what it will do. 48dp touch targets, Material Symbols icons, the system font.
- **Dashboard** *(built)*. The web's, in the same words: a greeting, this month's money (Finance's
  own two tiles), then every module with a "Coming in …" tag on the ones still to come.
- **Profile** *(built)*. **More**'s first row is the person — their name, or their email until
  they have one — and opens the profile: the name (empty falls back to the sign-in provider's),
  the email and sign-in methods (read-only, from Supabase Auth), and the preferred and display
  currencies. One form with one Save, where the web has a card and a Save for each; both send
  only what changed.
- **Theme** *(built)*. The web's eight colour schemes and light / dark / match system, from the
  same generator, as a TypeScript module (`mobile/src/theme/tokens.ts`). Match system is the
  default and follows the phone live. **More → Settings** *(built)* asks the web's two questions
  in its words — Appearance (light, dark, match system) and Colour scheme, each scheme with its
  two swatches in the mode on screen — as lists of radio rows. A choice applies at once, with no
  Save, and is remembered **on this phone**, as the web remembers it per browser: the look is a
  device's business, while the display currency travels with the account on the profile. The
  stored choice is read before the splash screen hides, so a chosen dark mode never flashes
  light.
- **Timezone** *(built)* follows the device and syncs to the profile on launch, as the web does in
  the browser — and again whenever the app comes back to the front, since the phone is the device
  that travels. It calls the API only when the phone's zone differs from the one last synced.
- **Background sync** *(built)* — fetching notifications now; reading steps, screen time and
  sleep later — runs on WorkManager through `expo-background-task`, asked for every 60 minutes
  (the library's default is every 12 hours, so the interval is always passed): best-effort, and
  delayed further by some phone makers' battery savers. Android runs it only with a connection
  and enough battery, and not at all once the app has been killed — which on some makers' phones
  includes swiping it out of recents. Every call it makes is idempotent, so a late or repeated
  run only catches up. The same sync
  runs at launch and whenever the app returns to the front. More → Settings shows **Last synced
  …**, and says so when the last run failed.
- **Xiaomi's battery saver is the one to beat.** HyperOS stops background work for apps it has
  not been told to leave alone, which on the reference device means syncs that never run. The
  app's setup screen walks through the two switches it needs — **Autostart** on, and **Battery
  saver → No restrictions** — and the sync status shows the gap when they are off, rather than
  leaving a stale step count looking current. It is offered on Xiaomi phones, and on any phone
  where Android reports background work restricted, and opens the app's page in Android's
  settings, where HyperOS keeps both switches. **The steps follow the phone**: only a Xiaomi is
  told about Autostart and Battery saver; any other phone gets Android's own one setting,
  **Battery → Unrestricted**. Settings → Notifications lists the setup only where it applies,
  or on any phone once the sync has fallen behind, so a phone that syncs fine never sees it. It
  says that reminders ring on time either way: the setup is for notices while the app is closed.
- **Notifications.** See [Phone notifications](#phone-notifications).
- **Online-only**, as the web is (decided 2026-11-12). See
  [Offline on Android](#offline-on-android).
- **No crash reporting yet.** As on the web, there is no error-reporting service for now; the
  app shows when each sync last succeeded. Sentry for the Android app — readable traces through
  uploaded source maps, native crashes, personal data stripped — is planned for the last
  development phase.
- **Distribution** *(v0.2)*. A signed APK, sideloaded — no store listing, no AAB. EAS Build
  makes it (profile `preview`), a GitHub Release tagged `android-v<version>` hosts it (the
  repository is public, so the download needs no account), and EAS Update ships
  JavaScript-only changes on the `preview` channel to installed apps on their next launch. An
  update reaches only the APKs whose native code it was built for: the runtime version is the
  native fingerprint. A new APK is needed only when native code or permissions change. **The app
  checks for one**: at launch, at most once a day, it reads the newest `android-v*` release from
  GitHub's API (no token), and when that is newer than itself the foot of More says "Version X is
  available" and links to the download. The author makes builds, releases and updates by hand.
  A release starts as a **draft**: the author installs it on their own phone and checks the
  install, an over-the-air update and the background run there before publishing it. The app's
  check ignores drafts and pre-releases, so nobody is pointed at an APK that hasn't been tried.
- **Two builds, two jobs.** The **development build** (`eas.json` profile `development`) is where
  every change is tested: it loads the JavaScript from the computer, so a change shows on the
  phone as it is saved. The **preview build** (profile `preview`, a standalone APK) is what users
  install, made once a version's testing on the development build is done. Over-the-air updates
  are the one thing the development build can't try — the update library works only in a
  release build — so updating is proven on the preview build, before its release is published.
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

**Not planned** (decided 2026-11-12): the Android app is online-only, as the web is. The work it
would take — a queue of unsent changes on the phone, conflict checks on every write endpoint, a
screen for clashes, a cache saved on the device — outweighed what it would bring to a few people
who are online almost everywhere. Why, and the design that was set aside so it need not be worked
out again: [ADR-0006](../adr/0006-android-app-stays-online-only.md).

Without a connection the app behaves as TanStack Query does by default: loads wait and run when
the connection comes back, a save waits on screen the same way while the app stays open, and
screens already loaded keep what they show. The one save that doesn't wait is a notification
switch, which fails at once ([Notification preferences](#notification-preferences)). Nothing is
saved on the device between launches but the session, the look and the phone's own
notifications — what it has scheduled, which the notification library keeps so it survives a
restart, the newest notice it has shown and the last day handled for each reminder. So
reminders the last sync scheduled still fire ([Phone notifications](#phone-notifications)).

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

Four workflows, no deploy workflow — Render and Vercel deploy natively on push to `main`.
Details in [`DeveloperGuide.md` § 9](../../DeveloperGuide.md#9-cicd-pipeline). `mobile-ci`
checks the Android app.

The one rule worth repeating here, because breaking it takes production down: **migrations do not
run themselves.** Render redeploys the instant a PR merges. Apply additive migrations to
production *before* merging the code that needs them, and split destructive changes across two
PRs, expand then contract.
