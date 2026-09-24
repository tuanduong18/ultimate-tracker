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
- **Google is the source of truth on conflict.** If the same event changed on both sides since the
  last sync, Google's version wins and the app surfaces the overwrite rather than silently
  resolving it. The user can retry their edit with the conflict visible.
- **Sync is incremental, never a full rewrite.** Google's `syncToken` drives it. A full re-list is
  the recovery path when a token expires, not the normal mode.
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
    sync_state          varchar    "synced|pending_push|conflict|local_only"
    created_at          timestamptz
    updated_at          timestamptz
```

`origin` and `sync_state` are the two columns that make two-way sync tractable. `origin` decides
who owns the event; `sync_state` decides what the next sync needs to do with it. Without them
every sync has to diff everything against Google to work out what changed.

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
- **[v0.2]** Pre-defined and custom time categories, productive and leisure.
- **[v0.2]** Daily and weekly stacked time breakdown chart.
- **[v0.3]** Committed-versus-spent view: calendar hours against logged hours for the same week.
- **[Future]** Android companion app for automatic screen time sync. Out of scope — this is a web-only project.

### Data model

| Table | Holds | Key columns |
|---|---|---|
| `time_sessions` | one tracked stretch | `category`, `kind` (`focus` / `entertainment`), `started_at`, `duration_minutes` |
| `entertainment_allowances` | a weekly cap | `category`, `weekly_minutes_cap` |

---

## Open questions

- How often should the scheduled sync run? Every 15 minutes is responsive enough for a calendar
  and cheap on quota; hourly may be enough given this is a single-user app.
- Should a synced Google event be allowed to count toward an entertainment allowance? It would
  make the allowance more accurate and the rules harder to explain.
- When a connection is deleted and re-added, should previously synced events re-link by
  `google_event_id` or come back as duplicates? Re-linking is better but needs the old ids kept
  after disconnect.
