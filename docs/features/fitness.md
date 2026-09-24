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

- **[v0.2]** Manual daily step logging with edit history.
- **[v0.2]** Step goal with a calendar heatmap.
- **[Future]** Google Fit / Health Connect auto-sync via OAuth. Explicitly out of scope while the
  app stays web-only and manual by design.

### Recovery

What training costs and what rest returns. Absorbs the sleep and mood half of Wellness.

- **[v0.3]** Sleep log — bedtime, wake time, quality rating, auto-calculated duration.
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
| `step_logs` | one day of walking | `logged_on` (unique per user), `step_count` |
| `sleep_logs` | one night | `logged_on`, `bedtime`, `wake_time`, `quality` |
| `mood_checkins` | one check-in | `logged_on`, `mood`, `energy` |
| `habits` / `habit_logs` | a habit and its daily ticks | `name`, `active` / `habit_id`, `logged_on`, `completed` |

**One row per day per user** for `step_logs`, `sleep_logs`, and `mood_checkins` — enforced with a
unique constraint, not just checked in the service. These are diary entries, not events; a second
row for the same day means an edit was mishandled somewhere.

---

## Endpoints

All under `/api/v1/fitness`, grouped by what they record:

```
/fitness/sessions           training sessions, full CRUD
/fitness/sessions/{id}/sets set entries within a session
/fitness/exercises          the exercise library
/fitness/records            detected personal records, read-only
/fitness/steps              daily step logs, full CRUD
/fitness/sleep              sleep logs, full CRUD
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
