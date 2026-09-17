# Feature Specifications

One document per domain. Each describes what the domain is for, what it must do, and
where it currently stands in the code — so the gap between plan and reality is visible
rather than assumed.

## The five domains

The app is organised into five tracking domains plus the platform that carries them.
**The order below is the order they appear in the sidebar, in the README, and in the
release plan.** It is deliberate, not alphabetical.

| # | Domain | Spec | Status |
|---|---|---|---|
| 1 | 💰 Finance & Budgeting | [`finance.md`](./finance.md) | Partly built |
| 2 | 🏋️ Health & Fitness | [`health-and-fitness.md`](./health-and-fitness.md) | Not started |
| 3 | ⏱️ Time Tracking & Calendar | [`time-and-calendar.md`](./time-and-calendar.md) | Not started |
| 4 | ✨ Cross-Domain Insights | [`insights.md`](./insights.md) | Not started |
| 5 | 🎮 Gaming Performance | [`gaming.md`](./gaming.md) | Not started — ships last, by design |
| — | 🔧 Platform & Core | [`platform.md`](./platform.md) | Partly built |

**Gaming Performance is last on purpose.** It is the most interesting domain to build,
which makes it the easiest one to start early and the most tempting thing to drift into
when a less exciting domain gets tedious. Keeping it at the end means the unglamorous
work — budgets, sleep logs, CI — gets finished, and there is something genuinely fun
left to build at the end rather than a pile of chores.

## Status vocabulary

These words mean specific things in these documents:

| Term | Meaning |
|---|---|
| **Built** | Shipped, tested, in use. Routes, services, models and tests all exist. |
| **Partly built** | Some capability shipped; the rest specified but not written. Each doc says which is which. |
| **Not started** | Specified here, no implementation. Route modules may exist as empty stubs. |
| **Planned** | Committed to a release in the [release plan](../../DeveloperGuide.md#14-release-plan). |
| **Future** | Wanted, not committed to any release. Do not build without moving it to a release first. |

## Related

Decisions about *why* the domains are shaped this way live in [`../adr/`](../adr/) —
notably [ADR-0002](../adr/0002-consolidate-health-domains.md) (why Steps, Fitness and Wellness
are one domain) and [ADR-0003](../adr/0003-two-way-google-calendar-sync.md) (why the calendar
syncs both ways).

## How to change a spec

These documents are the source of truth for *what the app should do*. If you are about
to build something that contradicts one, change the spec in the same PR — a feature doc
that disagrees with `main` is worse than no feature doc, because it gets trusted.

The reverse also holds: when a feature ships, update its **Status** section here. The
tables above are checked during review.
