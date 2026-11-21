# 6. The Android app stays online-only

- Status: Accepted
- Date: 2026-11-12

## Context

[ADR-0004](./0004-android-app-as-second-client.md) planned for every write in the Android app to
go through an offline outbox, so that logging on the move — a train, a basement food court —
would work without a signal. The app reached parity with the web without it, and the outbox was
the next piece to build.

Working it out showed the cost. Each kind of data needs its own rules for what counts as a
clash: a budget's categories, a subscription's schedule against the renewal job moving its
billing date, a category created offline with expenses pointing at it, an early renewal racing
the job. Narrowed to logs only (expenses, then each module's logs), it still meant three
endpoints changed on the backend with conflict tests, a queue and a saved cache on the phone, a
screen for clashes and refused writes, and Finance data kept on the device between launches,
which until now has held only the session.

The users are the author and a few friends, online almost everywhere they log something.

## Decision

The Android app is online-only, as the web is. It saves nothing on the device between launches
but the session, the look and its own notifications (what it has scheduled, the newest notice
it has shown and the last day handled for each reminder) — no Finance data. Without a connection
it behaves as TanStack Query does by default: loads wait and run when the connection comes back,
and a save waits on screen the same way while the app stays open. The one exception is a switch
that applies at once, such as a notification switch: it fails and flips back rather than wait.

What the phone holds itself still works without a signal: reminders scheduled at the last sync
are local notifications and fire on time ([platform.md § Phone notifications](../features/platform.md#phone-notifications)).

## Consequences

- No outbox, no conflict checks on the API, no clash screen, no persisted cache: every write
  endpoint keeps its current shape, and the server stays the only copy of anyone's data.
- A log made with no signal has to wait until there is one. Accepted for these users.
- Screens show only what the server has stored, as on the web; the phone never shows a change
  the server hasn't confirmed.
- Log out keeps needing no confirmation: nothing on the phone can be lost by it.

**If it is revisited**, the design worked out on 2026-11-12 is the starting point, so it need not
be worked out again:

- Only logs go offline (create, edit, delete); setting up — categories, budgets, subscriptions —
  stays online-only, since nobody does it on the move.
- A persisted queue on the phone, sent in order, one at a time; a queued edit or delete of a log
  whose create hasn't been sent folds into it. A persisted read cache, with when each screen last
  loaded.
- Creates carry a phone-made UUID; a repeat by the same person returns the stored row.
- Edits send, for each changed field, the value it was changed from; deletes send the row as last
  seen. The server compares those fields by meaning (`"12.5"` equals `"12.500"`), fields that
  only mean something together as one (an expense's amount and currency), and answers
  `409 EDIT_CONFLICT` with the current row. **Always after the ownership check**, so a `409` can
  never reveal another person's row.
- A clash or a refused write waits for the person in a list of its own, never settled silently.
  Totals stay the server's.
- The phone's copy kept private: out of Android's backups, cleared on log out, the queue tagged
  with whose it is and holding no tokens.
- Rejected on the way: last write wins (decides by arrival time and drops the other edit
  silently), a version or `updated_at` check (calls any concurrent change a clash, a job's
  included), and a sync engine or local-first database (a second data model for a few rows a day).
