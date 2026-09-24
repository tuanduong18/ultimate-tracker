# 2. Consolidate Steps and Wellness into the Fitness domain

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

Merge the three into a single **Fitness** domain, scope name `fitness`, served under one
`/api/v1/fitness` prefix and one nav entry.

Internally it is organised into four named areas so the domain does not become the new leftover
drawer: **Training** (gym, swim, sport), **Movement** (steps and walking), **Recovery** (sleep,
mood, energy), and **Habits**.

The tables stay separate — `training_sessions`, `step_logs`, `sleep_logs`, `mood_checkins`,
`habits` — rather than collapsing into a generic fitness-event row. Their columns have almost
nothing in common, and a table of mostly-null columns is harder to query than six honest ones.

Retire the `steps` and `wellness` commit scopes; `fitness` becomes the merged scope.

**On the name.** "Health & Fitness" describes the contents more accurately, and was the first
choice. It was rejected because `/api/v1/health` is already the operational liveness check that
Render and an uptime monitor poll. Moving that check to `/healthz` would have freed the name at
the cost of silently breaking production alerting until two external dashboards were updated by
hand. A label that reads slightly narrow is the cheaper mistake than one word meaning two
different things in the same API.

## Consequences

- Sleep-versus-training stops being a cross-domain correlation and becomes a domain asking about
  itself: cheaper to compute, easier to explain to the user.
- One `/fitness/summary` endpoint serves the dashboard from one service, instead of three round
  trips that the client then has to stitch.
- The nav drops from seven entries to six, and the remaining domains carry comparable weight.
- **Cost: the label under-describes the contents.** Someone reading "Fitness" will not expect to
  find mood check-ins under it. The four named areas are the mitigation, and the feature doc
  states the naming trade-off up front rather than leaving the next reader to rediscover it.
- **Cost: `fitness` is a broad domain** and will hold six tables. If a fifth area appears that is
  not about the state of the body, that is the signal to split rather than absorb.
- **Cost: the correlation engine loses some of its cross-domain framing.** Fewer pairs are
  strictly cross-domain, which matters only for how insights are described, not what they find.
- `/api/v1/health` stays exactly where it is, and stays the liveness check. No monitoring config
  changes.

Supersedes the seven-domain split described in [ADR-0001](./0001-decoupled-frontend-backend.md)
§ Context. That ADR's decision is unaffected.
