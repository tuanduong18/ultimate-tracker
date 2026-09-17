# 3. Two-way sync with Google Calendar

- Status: Accepted
- Date: 2026-09-17

## Context

Time Tracking originally covered only retrospective time: a focus timer and a weekly
entertainment allowance. That answers "where did last week go?" but not "what is coming?" — the
deadline on Friday, the class every Tuesday, the networking evening agreed to a month ago. Both
are the same finite resource, and only a domain holding both can say a week was over-committed
before it started.

Most of that data already exists in the user's Google Calendar. Re-entering it by hand would not
happen, so the app has to connect.

Two options:

**Read-only import** (`calendar.readonly`). Pull Google events in; events created in the app stay
in the app. Simple, safe, and impossible to damage anything outside the app.

**Two-way sync** (`calendar.events`). Google events import, and app-created events are written
back.

Read-only is materially cheaper and lower risk. It was rejected because it breaks the feature's
main use: a deadline or networking event created in Ultimate Tracker is only useful if it reaches
the calendar the user actually looks at — the one that alerts their phone. An event that exists
only inside a web app they open at a desk is an event they will miss. Half the domain would be
write-only in practice.

## Decision

Sync both directions with Google Calendar, using the `calendar.events` scope — read and write on
events, but no ability to create, rename, or delete calendars.

Because this is **the only feature in the app that writes to a system outside it**, it carries
stricter rules than anything else in the codebase:

- **The app owns only the events it created.** Imported Google events are read-only mirrors by
  default. The app never deletes a Google event it did not create.
- **Google wins conflicts.** If the same event changed on both sides since the last sync,
  Google's version stands and the app surfaces the overwrite rather than resolving it silently.
- **Sync is incremental** via Google's `syncToken`. A full re-list is the recovery path for an
  expired token, not the normal mode.
- **Every write is idempotent.** Creates use a client-generated event id, so a retried create
  resolves to the same Google event instead of a duplicate.
- **Sync failures are visible.** A silently broken sync is worse than a disconnected calendar,
  because the user keeps trusting a stale view.

Two columns make this tractable: `origin` (`app` or `google`) decides who owns an event, and
`sync_state` decides what the next sync must do with it.

## Consequences

- Events created in the app reach the user's real calendar, and therefore their phone. This is
  the whole reason for choosing it.
- **Cost: the blast radius is outside the app.** A bug in Finance produces a wrong number the
  user can correct. A bug here can duplicate or destroy entries on a calendar they depend on.
  This feature warrants heavier test coverage than its size suggests, including the retry and
  conflict paths.
- **Cost: the refresh token becomes the most sensitive thing stored.** It is encrypted at rest,
  never logged, and never returned by any endpoint, not even redacted.
- **Cost: real complexity.** A sync state machine, conflict detection via etags, recurring-event
  expansion, and Google API quota handling — none of which read-only import would have needed.
- Recurring events are expanded on read, not stored expanded. Storing every instance of a weekly
  class for a semester means a schedule change rewrites hundreds of rows.
- Scheduled sync needs a process that stays awake. Render's free tier spins down, so either the
  scheduler lives somewhere that does not, or an external pinger triggers it — which is another
  reason every job must be idempotent.
- **Reversible under pressure.** If two-way sync proves too costly, degrading to read-only import
  is a scope reduction, not a rewrite: the same tables and sync loop, with writes disabled.

Full specification in
[`docs/features/time-and-calendar.md`](../features/time-and-calendar.md#calendar).
