# 2. Consolidate Steps, Fitness and Wellness into one Health & Fitness domain

- Status: Accepted
- Date: 2026-09-17

## Context

The original domain split gave Steps & Walking, Fitness, and Wellness each their own sidebar
entry, API prefix, and dashboard page. Three problems surfaced once the app had a working
Finance domain to compare them against.

**The split cut through the data, not along it.** A hard training week, a low step count, five
hours of sleep, and a mood of 2 are one week of one body. The questions worth asking — does sleep
track training volume, does a losing streak show up in tomorrow's mood — span all three. Under
the split, every one of those was a cross-domain query requiring a fourth surface to join them
back together.

**"Wellness" was not a category.** It held sleep, mood, and habits, which share nothing except
not fitting anywhere else. A domain defined by exclusion attracts whatever comes next, and gets
harder to name over time.

**Steps was one integer per day** holding a top-level nav slot against domains with an order of
magnitude more behind them.

The timing forced the decision now rather than later: all three were unbuilt — empty router
stubs and "Coming soon" pages. The same change after they had tables, rows, and endpoints would
cost a data migration and a breaking API change.

## Decision

Merge the three into a single **Health & Fitness** domain, scope name `health`, served under one
`/api/v1/health` prefix and one nav entry.

Internally it is organised into four named areas so the domain does not become the new leftover
drawer: **Training** (gym, swim, sport), **Movement** (steps and walking), **Recovery** (sleep,
mood, energy), and **Habits**.

The tables stay separate — `training_sessions`, `step_logs`, `sleep_logs`, `mood_checkins`,
`habits` — rather than collapsing into a generic health-event row. Their columns have almost
nothing in common, and a table of mostly-null columns is harder to query than five honest ones.

Retire the `steps`, `fitness`, and `wellness` commit scopes in favour of `health`.

## Consequences

- Sleep-versus-training stops being a cross-domain correlation and becomes a domain asking about
  itself: cheaper to compute, easier to explain to the user.
- One `/health/summary` endpoint serves the dashboard from one service, instead of three round
  trips that the client then has to stitch.
- The nav drops from seven entries to five, and the remaining five carry comparable weight.
- **Cost: `health` is a broad domain** and will hold six tables. The four named areas are the
  guard against it sprawling; if a fifth area appears that is not about the state of the body,
  that is the signal to split rather than absorb.
- **Cost: the correlation engine loses some of its cross-domain framing.** Fewer pairs are
  strictly cross-domain, which matters only for how insights are described, not what they find.
- **Follow-up owed in code.** The merge is specified but not implemented: `app-nav.tsx` still
  lists three entries, three placeholder pages and three stub routers still exist. One PR, no
  migration, because nothing has rows behind it. Tracked in
  [`docs/features/health-and-fitness.md`](../features/health-and-fitness.md#migration-notes).

Supersedes the seven-domain split described in [ADR-0001](./0001-decoupled-frontend-backend.md)
§ Context. That ADR's decision is unaffected.
