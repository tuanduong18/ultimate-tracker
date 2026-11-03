# Time Tracking & Calendar

Where the hours go, and where they are going to go. This domain covers both halves: time you
have already spent, and time you have committed to.

- **Release:** v0.2 (timer and time budgets), v0.3 (calendar and events)
- **Scope name:** `time`
- **API prefix:** `/api/v1/time`
- **Code:** [`backend/app/api/v1/time_tracking.py`](../../backend/app/api/v1/time_tracking.py) —
  currently an empty router stub

---

## Status

**Not started.** The route module is a stub with no endpoints and the frontend page is a
placeholder. No models, services, or migrations.

Like Fitness, Time is built on backend, web and the Android app together
([ADR-0004](../adr/0004-android-app-as-second-client.md)); screen time exists only because the
phone can measure it.

---

## Two halves, one domain

The original spec covered only **retrospective** time: a focus timer and a weekly entertainment
allowance, answering "where did the last week go?". That is half the question. The other half is
"what is coming?" — the deadline on Friday, the class every Tuesday, the networking evening you
said yes to a month ago and forgot.

Both halves are the same resource, and keeping them apart makes the useful comparison impossible.
A week where you committed twenty hours to fixed events and still planned thirty hours of focus
work was over-committed before it began, and only a domain that holds both can say so.

So this domain now covers:

1. **Time spent** — the focus timer and entertainment budgets.
2. **Time committed** — a calendar of events, some created in the app, some synced from Google.

---

## Calendar

### What it must do

- Connect a Google account and **sync in both directions**.
- Import the timetable and events that already live in Google — classes, meetings, anything
  already scheduled.
- Let the user define events in the app — deadlines, dates, networking events, and any other
  category they create — and have those appear in Google too.
- Show the week as one view, regardless of which side an event came from.

### Two-way sync is the hard part

Worth stating plainly: **this is the most complex feature in the app, and the only one that
writes to a system outside it.** A bug in the finance domain produces a wrong number the user can
correct. A bug here can delete or duplicate events on a real calendar the user depends on.

The choice of two-way over read-only import is recorded as
[ADR-0003](../adr/0003-two-way-google-calendar-sync.md). It earns stricter rules than anything
else in this codebase:

- **The app owns only the events it created.** Events imported from Google are editable in the
  app only if the user explicitly says so; by default they are read-only mirrors. The app never
  deletes a Google event it did not create.
- **The user decides every conflict.** If the same event changed on both sides since the last
  sync, neither version wins on its own. The event goes to `sync_state = conflict`, keeping the
  app's version in the row and Google's in `google_conflict`; nothing about it is pushed or
  pulled until the user answers. A `calendar_conflict` notification shows both versions and asks
  which to keep, and the week view marks the event until then. The same applies when one side
  deleted an event the other side edited: the question is whether to restore it or let it go.
  See [Conflicts](#conflicts).
- **Sync is incremental, never a full rewrite.** Google's `syncToken` drives it. A full re-list is
  the recovery path when a token expires, not the normal mode.
- **Hourly.** The scheduler runs the sync once an hour, like the other jobs; for a calendar that
  is mostly classes and deadlines planned days ahead, more often buys nothing. An edit made in the
  app is pushed at once, and `POST /time/calendar/sync` forces a pull.
- **Every write is idempotent.** A retried sync must not create a second copy of an event. The
  local `google_event_id` is the join key, and creates use a client-generated event id so a
  retried create resolves to the same Google event.
- **Sync failures are visible.** A silently broken sync is worse than a disconnected calendar,
  because the user keeps trusting a stale view. Surface the last successful sync time.

### Data model

```
CALENDAR_CONNECTIONS
    id                  uuid PK
    user_id             uuid FK -> profiles.id
    google_account_email varchar
    refresh_token       text          encrypted at rest, never returned by the API
    calendar_id         varchar       which Google calendar is synced
    sync_token          text, nullable  Google incremental sync cursor
    last_synced_at      timestamptz, nullable
    last_sync_error     text, nullable
    created_at          timestamptz

EVENTS
    id                  uuid PK
    user_id             uuid FK -> profiles.id
    event_type          varchar    "class|deadline|date|networking|other" — user-extensible
    title               varchar(200)
    description         text, nullable
    starts_at           timestamptz
    ends_at             timestamptz
    all_day             bool
    location            varchar, nullable
    origin              varchar    "app|google" — which side created it
    google_event_id     varchar, nullable, unique per connection
    google_etag         varchar, nullable   for conflict detection
    google_conflict     jsonb, nullable     Google's version while a conflict is unanswered
    sync_state          varchar    "synced|pending_push|conflict|local_only"
    created_at          timestamptz
    updated_at          timestamptz
```

`origin` and `sync_state` are the two columns that make two-way sync tractable. `origin` decides
who owns the event; `sync_state` decides what the next sync needs to do with it. Without them
every sync has to diff everything against Google to work out what changed.

### Conflicts

A conflict is any sync where the app cannot apply one side's change without discarding the
other's. The rule, everywhere, is that **the user decides**:

| Situation | Asked |
|---|---|
| Edited in the app and in Google since the last sync | Keep the app's version or Google's? |
| Deleted in Google, edited in the app | Put it back in Google, or delete it here too? |
| Deleted in the app, edited in Google | Delete it from Google too, or keep Google's version here? |
| Reconnecting: an event re-linked by `google_event_id` differs from Google's copy | Keep the app's version or Google's? |

`POST /time/events/{id}/resolve` with `keep: "app"` or `"google"` answers it: the chosen version
is written to the losing side, `google_conflict` is cleared, the event returns to `synced`, and
the notification moves to the history. An event imported from Google stays read-only unless the
user made it editable, so it can only conflict once they have.

**Reconnecting re-links rather than duplicates.** Disconnecting keeps each event's
`google_event_id` (the events become `local_only`). When the same Google account and calendar
are connected again, the first sync matches events by that id: identical ones re-link silently,
and ones that changed on either side in between are conflicts, asked as above.

A **recurring** event from Google expands into instances on read rather than being stored
expanded — storing every instance of a weekly class for a whole semester means a schedule change
has to rewrite hundreds of rows.

### Event types

`event_type` is a string, not a fixed enum, because the user defines their own categories. The
five shipped defaults — class, deadline, date, networking, other — are seeds, not a closed set.

A **deadline** is the one type with different semantics: it is a point in time, not a span. It
stores `starts_at` equal to `ends_at` and renders as a marker rather than a block.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/time/calendar/connection` | Connection status, last sync, last error. Never returns tokens. |
| `POST` | `/time/calendar/connect` | Begins the Google OAuth flow. |
| `DELETE` | `/time/calendar/connection` | Disconnect. Synced events become `local_only` rather than being deleted. |
| `POST` | `/time/calendar/sync` | Force a sync. Normally runs on a schedule. |
| `GET` | `/time/events` | List within a range. The one view over both origins. |
| `POST` | `/time/events` | Create. Pushes to Google when a connection exists. |
| `PATCH` | `/time/events/{id}` | Edit. Refuses on an unresolved conflict. |
| `POST` | `/time/events/{id}/resolve` | Answer a conflict: `keep: "app"` or `"google"`. |
| `DELETE` | `/time/events/{id}` | Delete. Only removes from Google if the app created it. |

### OAuth scope

Two-way sync needs `https://www.googleapis.com/auth/calendar.events` — read and write on events,
which is narrower than full `calendar` access. Do not request full calendar scope; the app never
needs to create, rename, or delete calendars.

The refresh token is the most sensitive thing this app stores. It is encrypted at rest, never
logged, and never returned by any endpoint — not even a redacted one.

---

## Time tracking

The retrospective half, unchanged from the original spec.

- **[v0.2]** Focus timer — start, pause, stop, category-tagged, no rigid Pomodoro constraint.
- **[v0.2]** Entertainment budget — weekly allowance per category, remaining-time display, warning at 80%.
  Calendar events never count toward it: an allowance measures time spent, and an event is time
  committed, which may not have happened.
- **[v0.2]** Pre-defined and custom time categories, productive and leisure.
- **[v0.2]** Daily and weekly stacked time breakdown chart.
- **[v0.3]** Committed-versus-spent view: calendar hours against logged hours for the same week.
- **[v0.2]** On Android, the focus timer runs as an ongoing notification, so it survives leaving
  the app, and can turn on Do Not Disturb for the session.
- **[v0.2]** Screen time from the Android app: per-app foreground minutes per day, with apps
  mapped to time categories so phone time counts toward entertainment allowances. See
  [Screen time](#screen-time).

### Screen time

Nobody can report their own screen time honestly — not knowing it is the reason to track it. So
it is the one kind of time that is never entered by hand: the Android app reads it from the
operating system's usage statistics (`UsageStatsManager`) and sends daily totals to the backend.

**Only the apps the user chose to track leave the phone by name.** Per-app minutes say a lot
about a person — the dating app, the health app, the bank — and the server's owner can read
every row, row-level security or not. So the server learns two things: minutes per day for the
apps the user picked, and the day's **total screen time** across every app, tracked or not.
Everything else stays on the phone.

- **Measured from events, not buckets.** Foreground time is computed from the app-moved-to-
  foreground and moved-to-background events. Android's pre-bucketed daily totals are known to
  drift and misattribute time across day boundaries.
- **Tracked apps are chosen at setup.** The phone suggests the apps Android itself files under
  games, video and social; the user ticks or unticks them, and can change the list at any time.
  Each tracked app is mapped to one of the user's time categories, so YouTube can count as
  entertainment and Anki as study. System apps and the launcher are never offered.
- **Per tracked app, per day**, plus the day's total, in the user's timezone. Sent as a batch
  upsert like steps: the last two days on each background run, the last 7 on first permission.
  Resending a day replaces it.
- **Re-categorising fixes history.** Because tracked apps are stored per app, moving one to
  another category re-sorts its past days too. Untracking an app deletes its rows; its minutes
  remain only inside the daily total.
- **Counts toward allowances.** Minutes in tracked apps mapped to an entertainment category draw
  down that category's `entertainment_allowances` cap alongside timer sessions. The phone warns
  at 80% and at the cap as soon as its own count crosses, while the user is still in the app (see
  [Phone notifications](./platform.md#phone-notifications)); the server writes the same alert
  for the web's bell.
- **Usage access is a manual grant.** Android has no permission dialog for it; the user turns it
  on in Settings → Usage access. On Android 13 and later a sideloaded app may first need
  **Allow restricted settings** from its App info menu. The app explains both steps on one
  screen before sending the user to Settings, and shows when the last sync ran.
- **Web shows it read-only.** The web cannot measure anything; it shows the same daily totals and
  lets the user change the category of a tracked app. Choosing which apps are tracked happens on
  the phone, the only place that knows what is installed.
- **Screen-off time at night** comes from the same usage events, and is how the app detects
  sleep — see [Sleep detection](./fitness.md#sleep-detection).

### Data model

| Table | Holds | Key columns |
|---|---|---|
| `time_sessions` | one tracked stretch | `category`, `kind` (`focus` / `entertainment`), `started_at`, `duration_minutes` |
| `entertainment_allowances` | a weekly cap | `category`, `weekly_minutes_cap` |
| `screen_time_days` | one tracked app's use on one day | `used_on`, `package_name`, `app_label`, `foreground_minutes` — unique per user, day and package |
| `screen_time_totals` | the day's total screen time, every app | `used_on` (unique per user), `total_minutes` |
| `app_categories` | the tracked apps, and where their time goes | `package_name` (unique per user), `app_label`, `category` — a row per tracked app; no row, not tracked |

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/time/screen-time/sync` | A batch of days from the phone: each day's total, and minutes per tracked app. Replaces what it carries. |
| `GET` | `/time/screen-time` | Within a range: daily totals, and minutes per tracked app and per category. |
| `GET` / `PUT` / `DELETE` | `/time/app-categories` | The tracked apps. `PUT` tracks an app or changes its category; `DELETE` untracks it and deletes its rows. |

Timer and allowance endpoints are specified when that half is built.

---

## Open questions

- Should screen time on an app mapped to a *productive* category count as focus time? It would
  make the committed-versus-spent view fuller, and blur the line between a timed focus session
  and an hour that merely had a study app open.
