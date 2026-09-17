# Gaming Performance

Match history, performance trends, and the honest question of whether you should have stopped
three games ago.

- **Release:** last — after v0.4, once everything else is finished and stable
- **Scope name:** `gaming`
- **API prefix:** `/api/v1/gaming`
- **Code:** none yet

---

## Status

**Not started, and deliberately not scheduled into v0.1–v0.4.**

---

## Why this one is last

This is the most interesting domain in the app. That is exactly why it ships last.

Every other domain is a form and a chart. This one has an external API with real match data,
genuine analysis to do, and a result worth showing someone. Left unscheduled, it is the thing
that gets started during the third week of writing budget CRUD — and then the app has a
half-finished gaming integration and no working sleep log.

Keeping it at the end does two things. It guarantees the unglamorous domains actually get
finished, because there is no more appealing alternative to drift toward. And it leaves something
genuinely enjoyable at the end of an eighteen-plus-domain-week grind, instead of finishing on a
polish-and-observability pass.

**Do not pull this forward.** If it starts feeling like the natural next thing to build, that is
the signal the current domain is boring, not that this one is ready.

---

## What it would cover

- **Manual session logging** — game, duration, result, self-rated performance. Works without any
  external API and is the fallback for games with no public data.
- **Riot API integration** — League of Legends and Valorant match history, pulled automatically:
  result, KDA, role, duration, queue.
- **Steam integration** — playtime per title. Much thinner data than Riot; playtime and little else.
- **Tilt detection** — loss streaks, performance decay by time of day, and the session-length
  point after which results reliably fall off.
- **Performance trends** — win rate and self-rating over time, by game and by role.

---

## Where it earns its place

Gaming is the domain most likely to produce a correlation the user did not want to see, which
makes it the most valuable input the insights engine could have:

| Between | Example question |
|---|---|
| Gaming × Health | Does win rate drop after a bad night of sleep? |
| Gaming × Time | Does a long gaming session cost the next day's focus hours? |
| Gaming × Health | Does a losing streak show up in the next morning's mood check-in? |
| Gaming × Finance | Does entertainment spend rise during a losing week? |

None of this works without the other domains already holding weeks of data — another reason this
is last rather than first.

---

## Known constraints

- **Riot's API requires a registered application** and enforces rate limits that a personal
  project will hit during backfill. Match history has to be fetched incrementally and cached
  locally, not re-pulled on every page load.
- **Riot match data has a retention window.** Old matches disappear from the API, so anything the
  app wants to keep must be stored locally when first seen.
- **Steam's data is thin.** Playtime totals, not per-session records. Expect to combine it with
  manual logging rather than replace manual logging with it.
- **Tilt detection is a heuristic, not a measurement.** It should be presented as a pattern the
  user can judge, subject to the same honesty rules as every other insight — see
  [`insights.md`](./insights.md#rules-the-engine-must-follow).
