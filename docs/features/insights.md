# Cross-Domain Insights

The reason the other domains share one app. Every tracker here exists so that this one can find
the patterns none of them could see alone.

- **Release:** v0.3
- **Scope name:** `insights`
- **API prefix:** `/api/v1/insights`
- **Code:** [`backend/app/api/v1/insights.py`](../../backend/app/api/v1/insights.py) — currently an
  empty router stub

---

## Status

**Not started.** Route module is a stub, frontend page is a placeholder.

This domain is last in build order among the non-gaming domains for a hard reason: it has nothing
to correlate until the others have been collecting for weeks. Building it early would mean
testing it against synthetic data, which is exactly the way to ship a correlation engine that
finds patterns in noise.

---

## What it must do

- **[v0.3]** Weekly digest — a plain-language summary of the week with one actionable suggestion,
  delivered in the app.
- **[v0.3]** Correlation engine — surfaces patterns across domains, in plain language, only once
  enough data exists.
- **[v0.3]** Insights dashboard — digest archive, saved and dismissed correlations.
- **[Future]** Monthly deep-dive review, exportable as PDF.

---

## The correlations worth finding

The domain split determines what can be correlated. With Finance, Fitness, and Time &
Calendar, the pairs that carry real signal are:

| Between | Example question |
|---|---|
| Fitness × Time | Are focus hours higher on days with more movement? |
| Fitness, internally | Does sleep quality track training volume, or lag it by a day? |
| Finance × Fitness | Does spending rise in weeks when training drops? |
| Finance × Time | Does entertainment time predict entertainment spend? |
| Calendar × Fitness | Do heavily committed weeks cost sleep? |
| Calendar × Finance | Do subscription renewals cluster where the money is already tight? |

Folding Steps and Wellness into Fitness helped here. Under the old split, "sleep versus
training" was a cross-domain correlation between two separate trackers; now it is one domain
asking about itself, which is cheaper to compute and easier to explain.

---

## Rules the engine must follow

These are the difference between an insight and a horoscope.

**No output below a data threshold.** Nothing is surfaced until at least three weeks of data
exist for both sides of a correlation. An engine that produces a confident-sounding claim from
four days of data is worse than one that stays quiet.

**Correlation is stated as correlation.** The copy says what moved together, never what caused
what. "Your focus hours are 40% higher on days you hit your step goal" is honest. "Walking more
makes you focus better" is not, and it is the kind of sentence that makes people distrust the
whole app.

**Multiple comparisons are accounted for.** Testing every pair of metrics against every other pair
will produce significant-looking results from pure noise. The engine tests a fixed, small,
pre-declared set of hypotheses — the table above — rather than sweeping everything against
everything.

**Every insight is dismissible, and dismissal sticks.** A pattern the user has judged
uninteresting must not resurface next week with a slightly different number.

**The digest says something even when nothing correlates.** "Nothing stood out this week" is a
valid, useful digest. Manufacturing an insight to fill the slot is how the feature loses trust.

---

## Data model

| Table | Holds | Key columns |
|---|---|---|
| `weekly_digests` | one generated digest | `week_start`, `summary` (jsonb), `delivered_at` |
| `correlations` | one detected pattern | `metric_a`, `metric_b`, `coefficient`, `sample_weeks`, `detected_on`, `dismissed_at` |

The digest stores its rendered summary as jsonb rather than regenerating it on read. A digest is
a record of what the app said that week; if the engine changes later, past digests must not
retroactively change their minds.

---

## Delivery

The weekly digest and the subscription renewal reminders share the same scheduled-job
infrastructure, built in v0.2 for subscriptions and reused here.

**In the app, not by email.** The digest is a notification like any other — in the bell on both
clients, and kept on the Insights page as the archive. Email was the original plan and was
dropped on 2026-11-03: for a handful of users who already open the app daily, an email is one
more place to look and one more service to run, and a digest read inside the app is one tap
from the data it talks about. Turning it off is a notification preference, like every other
kind.
