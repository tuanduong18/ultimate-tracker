# Fitness

Everything about the state of your body in one domain: what you trained, how far you walked,
how you slept, how you felt, and the habits meant to hold it together.

- **Release:** v0.2 (training and movement), v0.3 (recovery and habits)
- **Scope name:** `fitness`
- **API prefix:** `/api/v1/fitness`
- **Code:** [`backend/app/api/v1/fitness.py`](../../backend/app/api/v1/fitness.py) — currently an
  empty router stub

---

## Status

**Not started.** The route module exists as a stub with no endpoints, and the frontend page is a
"Coming soon" placeholder. No models, services, or migrations.

Fitness is the first domain built on backend, web and the Android app together
([ADR-0004](../adr/0004-android-app-as-second-client.md)).

---

## Why this is one domain, not three

Earlier drafts split this into **Steps & Walking**, **Fitness**, and **Wellness** — three sidebar
entries, three sets of endpoints, three dashboard pages. Steps and Wellness have been folded into
Fitness. Recorded as [ADR-0002](../adr/0002-consolidate-fitness-domains.md).

The split was wrong for three reasons:

**The data is one story.** A hard training week, a low step count, five hours of sleep, and a
mood of 2 are not four unrelated facts — they are one week, and the interesting question is how
they moved together. Splitting them across three pages meant the app itself could never ask that
question without a fourth page to join them back up.

**"Wellness" was not a category, it was a leftover.** It held sleep, mood, and habits, which have
nothing in common except that none of them fitted anywhere else. Sleep and mood belong next to
training because they are what training costs and what recovery buys. Habits belong there because
most of them are health habits.

**Steps did not deserve top billing.** A single integer per day was a whole sidebar entry
competing with everything else, which made the app look like it tracked one number well. It is
one signal among several about how much you moved, and it sits better beside the sessions.

> **On the name.** "Fitness" is narrower than what this domain holds — sleep, mood and habits are
> not training. It wins anyway because `/api/v1/health` is already the operational liveness check
> that Render and UptimeRobot poll, and one word meaning two things in one API is worse than a
> label that reads slightly broad. Treat Fitness here as the umbrella over the four areas below,
> not as training alone.

The merge is a documentation and product decision, implemented in code in the same branch — see
[Migration notes](#migration-notes).

---

## What it covers

### Training

Structured, deliberate exercise: gym, swimming, sport, anything with a start and an end.

- **[v0.2]** Session logger — type, duration, intensity, notes.
- **[v0.2]** Exercise library and reusable templates, plus custom exercises.
- **[v0.2]** Personal record auto-detection and history.
- **[v0.3]** Progressive overload tracker with stagnation warnings.
- **[v0.3]** Consistency heatmap and muscle group frequency.

### Movement

Everything you did without calling it exercise. Absorbs what used to be Steps & Walking.

- **[v0.2]** Manual daily step logging with edit history, on both clients.
- **[v0.2]** Step goal with a calendar heatmap.
- **[v0.2]** Automatic steps on Android, from the phone's own step counter — no other app
  needed. The phone's count replaces a hand-logged one, with a notice saying so — see
  [Phone sync](#phone-sync).
- **[v0.2]** Health Connect as an optional source for steps, for a watch or band that sees more
  than the phone — see [Health Connect](#health-connect).
- **[Future]** Health Connect exercise sessions feeding `training_sessions`.

### Recovery

What training costs and what rest returns. Absorbs the sleep and mood half of Wellness.

- **[v0.3]** Sleep log — one or more sleep stretches per night, a quality rating, and the
  duration they add up to.
- **[v0.3]** Sleep detection on Android: the phone records the stretches the screen stayed off
  inside a sleep window the user sets. See [Sleep detection](#sleep-detection).
- **[v0.3]** Health Connect as an optional source for sleep, merged with the phone's own
  detection — see [Health Connect](#health-connect).
- **[v0.3]** Daily mood and energy check-in on a 5-point scale, under five seconds to complete.

### Habits

- **[v0.3]** Custom habit tracker with streaks and completion rate.
- **[Future]** Per-habit reminder notifications.

---

## Data model

Six tables, one domain. Kept separate rather than collapsed into a generic "fitness event" row
because their columns have almost nothing in common, and a table of mostly-null columns is
harder to query than six honest ones.

| Table | Holds | Key columns |
|---|---|---|
| `training_sessions` | one workout | `session_type`, `duration_minutes`, `intensity`, `occurred_at`, `notes` |
| `training_set_entries` | sets within a session | `session_id` FK, `exercise_name`, `sets`, `reps`, `weight_kg` |
| `step_logs` | one day of walking | `logged_on` (unique per user), `step_count`, `source` (`manual` / `phone` / `health_connect`), `device_count` |
| `sleep_logs` | one night | `logged_on` (the date the night ends), `quality`, `source` (`manual` / `phone` / `health_connect`) |
| `sleep_segments` | one stretch of sleep within a night | `sleep_log_id` FK, `starts_at`, `ends_at` |
| `mood_checkins` | one check-in | `logged_on`, `mood`, `energy` |
| `habits` / `habit_logs` | a habit and its daily ticks | `name`, `active` / `habit_id`, `logged_on`, `completed` |

**One row per day per user** for `step_logs`, `sleep_logs`, and `mood_checkins` — enforced with a
unique constraint, not just checked in the service. These are diary entries, not events; a second
row for the same day means an edit was mishandled somewhere.

---

## Phone sync

The Android app counts steps itself, from the phone's **step-counter sensor** — a low-power chip
that keeps counting while the app is not running, read through a small Kotlin module after the
user grants Android's *physical activity* permission. No other app is needed. The chip's count
is cumulative, so readings taken an hour apart, or further when the battery saver holds the app
back, still add up to the right total; the gap only blurs which hour the steps fell in. The chip
resets when the phone restarts, so steps since the last reading before a restart are lost, and
the app spots the reset and carries on from zero.

Counting starts at install: there is no history before it. Daily totals go to the backend on
every background run (about hourly, best-effort) and whenever the app opens, re-sending today and
yesterday. Sending the same day twice is harmless — the endpoint is a batch upsert keyed by
`logged_on`.

The phone and the user can disagree. Someone logs 6,000 steps by hand on the web, then the phone
syncs 8,412 for the same day. **The phone's count wins, and the user is told.** A step count is
low-stakes and always editable, so stopping to ask would cost more than it saves.

- `source` says who set `step_count` last: `manual`, or a device source — `phone` or
  `health_connect` (see [Health Connect](#health-connect)). `device_count` is the last number
  the phone sent for that day.
- A sync whose number **differs from `device_count`** writes it to both `step_count` and
  `device_count`, and gives the day the source it came from.
- If that replaced a **manual** number that was different, the same request writes a
  `steps_replaced` notice: "Your phone counted 8,412 steps on 2 Nov, replacing the 6,000 you
  logged." It is written at once, the way a subscription edit rewrites its reminders, and its
  `dedupe_key` (`steps:<date>:<count>`) makes a retried sync harmless.
- A sync whose number **equals `device_count`** changes nothing. So a hand edit made after the
  phone's count sticks, until the phone reports a different number for that day. For a past day
  the phone's count has settled, and the edit stays for good. For today it is still climbing,
  and the next sync takes over again, which is right: the phone is still counting.

---

## Endpoints

All under `/api/v1/fitness`, grouped by what they record:

```
/fitness/sessions           training sessions, full CRUD
/fitness/sessions/{id}/sets set entries within a session
/fitness/exercises          the exercise library
/fitness/records            detected personal records, read-only
/fitness/steps              daily step logs, full CRUD
/fitness/steps/sync         POST: a batch of daily totals from the phone, upserted by day
/fitness/sleep              sleep logs and their segments, full CRUD
/fitness/sleep/sync         POST: nights detected by the phone, replacing only nights not `manual`
/fitness/mood               mood and energy check-ins
/fitness/habits             habit definitions
/fitness/habits/{id}/logs   daily completion ticks
/fitness/summary            the domain rollup that feeds the dashboard
```

A single `fitness` prefix rather than three is what makes the cross-cutting query cheap: the
summary endpoint reads training, movement, and recovery from one service without three round
trips.

**`/api/v1/health` is not part of this domain.** It is the operational liveness check, polled by
Render and an uptime monitor. Do not mount domain routes under it.

---

## Sleep detection

*v0.3, Android.* Nobody writes down when they fell asleep. The phone knows when its screen went
dark and when it lit up again, from the same usage events that measure
[screen time](./time-and-calendar.md#screen-time), so it can record the night without asking.

**The user sets a sleep window** — a range of local time, such as 21:00–11:00, in which they
might be asleep. Inside it, every long enough stretch with the screen off counts as sleep.
Outside it, nothing does: a phone face down through a long meeting is not a nap.

- **Advice: make the window wide.** The setup screen recommends starting well before a usual
  bedtime and ending well after a usual wake time, so late nights and lie-ins are still caught.
  The cost of too wide is an evening with the phone on the desk counted as sleep — visible, and
  one tap to delete. The cost of too narrow is sleep that is silently never recorded.
- **A night can have several segments.** Getting up at 1 a.m. and scrolling until 3 a.m. makes
  two: 23:00–01:00 and 03:00–09:00. Each is a row in `sleep_segments`; the night's duration is
  their sum, not wake time minus bedtime.
- **Glances do not split a night.** A screen that lights up for under 5 minutes — checking the
  time, a notification waking the display — is absorbed into the segment around it. A screen-off
  stretch shorter than 30 minutes is not sleep. Both thresholds are defaults, tuned on real
  nights before they are offered as settings.
- **The phone works it out; only the result leaves it.** The device computes the segments and
  sends each finished night, once the window has closed, to `POST /fitness/sleep/sync`. The raw
  screen events never leave the phone.
- **The user's edits stick.** Segments can be moved, split, joined, added or deleted, on either
  client. Editing a night makes it `manual`, and a later sync never touches a `manual` night
  again; any other night is replaced by each re-sync of it, which is harmless because the
  events behind a finished night do not change.
- **Known blind spots.** Reading in bed with the screen on is, correctly, not sleep. A phone
  left charging in another room while the user is awake is counted as sleep — the case the
  user deletes by hand.

The window is stored on the profile (`sleep_window_start`, `sleep_window_end`, local times;
null turns detection off), so both clients show and edit the same one. The morning's
"How did you sleep?" check-in, when it exists, is prompted at the window's end.

A segment belongs to the sleep log of the local date it ends on, so a night that ends on 4 Nov
and a nap on the afternoon of 4 Nov are both on 4 Nov's log.

---

## Health Connect

*Steps v0.2, sleep v0.3, Android.* [Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect)
is Android's shared store for health data: fitness apps and watches write into it, and other
apps read from it with the user's permission. It records nothing itself — it holds what other
apps wrote. So it is **never required**: the phone's step counter and screen-off detection work
for everyone, and Health Connect is an **opt-in source** for someone whose watch or band sees
more, such as steps taken with the phone on a desk, or sleep measured on the wrist.

**A switch per data type**, in Settings on the phone:

> **Steps from:** This phone / Health Connect
> **Sleep from:** Screen-off detection / Health Connect

- **Turning one on** asks for Health Connect's permission for that data type, and only then:
  nobody who leaves it off is ever asked.
- **A switch applies from the day it changes, never before.** The day it is turned on is its
  first Health Connect day, and every earlier day stays exactly as it was. Turning it off is the
  mirror image: the phone's own data from that day on, and the Health Connect days before it
  untouched. The profile stores each data type's source and the date it last changed
  (`steps_source`, `steps_source_since`, `sleep_source`, `sleep_source_since`); the phone never
  re-sends a day before that date, and the server ignores one if it does.
- **The phone's own data is always the fallback.** The step counter and screen-off detection
  keep running while a switch is on, so a day Health Connect has nothing for — the watch on its
  charger — still has a number.
- **Edits still win.** A sleep night the user edited is never touched; a typed step count is
  replaced only under [the usual rule](#phone-sync), with its notice.

**Steps: the larger of the two, each day.** With the switch on, a day's count is whichever is
larger: Health Connect's total or the phone's own. Both measured the same walking, so the larger
one missed less — a watch that died at noon has 2,000 where the phone has 8,000, and a phone left
on a desk has less than the watch. The two are never added, which would count every step taken
with both twice. Health Connect already removes overlaps between its own sources. The day's
`source` says which one won.

**Sleep: the intervals are merged.** With the switch on, a night combines both sources:

1. Take the screen-off segments, filtered as in [Sleep detection](#sleep-detection) — inside the
   sleep window, at least 30 minutes, glances absorbed.
2. Add the sleep sessions Health Connect recorded, **wherever they fall**. The window exists to
   stop false guesses from the screen; a watch-recorded nap at 3 p.m. is not a guess.
3. Merge overlapping intervals into one — the classic merge-intervals pass: sort by start, then
   extend or begin a segment.
4. **Cut out every stretch the watch recorded as awake.** The watch measured the body, the phone
   only knew its screen was off, so a 02:10–02:40 awake stretch splits a segment even if the
   screen stayed dark.
5. Absorb gaps under 5 minutes, as for glances.

The night's `source` is `health_connect` if any of its segments came from Health Connect, and
`phone` otherwise.

---

## Migration notes

The merge is implemented as of this branch:

- `frontend/components/shared/app-nav.tsx` — `MODULES` listed `/steps`, `/fitness` and
  `/wellness` as three entries; now one `/fitness`.
- `frontend/app/(app)/steps/` and `/wellness/` — deleted. `/fitness/` absorbs them.
- `backend/app/api/v1/steps.py` and `wellness.py` — deleted, and unmounted from the aggregate
  router. `fitness.py` is the merged router. All three were empty stubs, so nothing was lost.
- Commit scope — `steps` and `wellness` are retired; `fitness` is the merged scope. Enforced by
  [`.github/workflows/pr-title.yml`](../../.github/workflows/pr-title.yml), which rejects the old
  names.

Nothing here had users or rows behind it, so the merge cost one PR and no migration. Doing it
before the tables existed is the whole reason it was cheap.
