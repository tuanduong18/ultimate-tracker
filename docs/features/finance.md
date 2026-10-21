# Finance & Budgeting

Track what you spend, cap it by category, and keep recurring costs from going unnoticed.
This is the first domain built and the most complete.

- **Release:** v0.1 (core), v0.2 (subscriptions)
- **Scope name:** `finance`
- **API prefix:** `/api/v1/finance`
- **Code:** [`backend/app/api/v1/finance.py`](../../backend/app/api/v1/finance.py) ·
  [`services/finance/`](../../backend/app/services/finance/) ·
  [`models/finance.py`](../../backend/app/models/finance.py)

---

## Status

**Built:**

- Categories — full CRUD, each with a name and a colour.
- Expenses — full CRUD, each with its own currency, amount, optional category, date and note.
- Budgets — full CRUD. A budget is a named cap applied to **any number of categories**
  (many-to-many), of one of two kinds: **monthly**, which starts fresh every calendar month, or
  **custom**, over one fixed date range. See [Budgets](#budgets).
- Multi-currency — every expense and budget stores its own currency. Totals convert into the
  user's display currency server-side, using rates stored in the `exchange_rates` table by a
  daily scheduled job; requests never call open.er-api.com. The same table decides which
  currencies can be picked. See [Exchange rates](#exchange-rates).
- Budget progress — spend-to-date against each cap, converted.
- Breakdowns — spend by category and spend by period (day or week buckets), both filterable by
  category and comparable across two date ranges.
- Finance dashboard — four panels: two comparison charts over a categories / expenses / budgets row.

**Not built:**

- Subscriptions — schema, CRUD and routes are built; renewal and reminders are not (see below).
- Budget breach alerts. Progress is calculated and displayed; nothing notifies you.
- Income. The domain is expense-only today; there is no income/expense type split.
- CSV import, savings goals.

---

## Budgets

A budget caps spending in one or more categories, in its own currency. There are two kinds, and
the kind decides which expenses count:

| Kind | Dates stored | Measured over, when viewing a month |
|---|---|---|
| **Monthly** | `starts_on` = the 1st of its first month; `ends_on` = the last day of its last month, or null for ongoing | That calendar month only — a fresh cap every month |
| **Custom** | the exact range the user picked; `ends_on` required | The whole range, in every month it touches |

**Monthly budgets reset by calculation, not by writing anything.** Progress for a month counts
only that month's expenses, so nothing happens when a month turns over and no scheduled job is
involved. Looking at an earlier month — the Budgets panel's ‹ month › control, or
`GET /finance/budgets/progress?month=YYYY-MM-DD` — simply measures that month instead. Without
`month`, the endpoint uses the current month in the profile's timezone.

**A custom budget is one cap.** A trip from 25 September to 8 October shows in both months'
views and reports the same full-range spend in each, because splitting it by month would invent
two caps the user never set.

Rows written before `period` existed are all `custom`, which is exactly what they already meant.
There is deliberately **no rollover** of unspent money into the next month, and no weekly or
yearly kind yet; `period` is a CHECKed string so either can be added without an enum migration.

There is no single "budget left" figure on the dashboard. Budgets cover different dates,
categories and currencies, so any total across them would be wrong; each is shown against its
own cap instead.

---

## Subscriptions

**Status: in progress. Release: v0.2 — the whole feature in one release, reminders included.**
Built: schema, CRUD service and routes. Not built: the renewal job and reminders.

Recurring costs are the spending that hurts most and gets watched least: they are invisible
between renewals, and each one individually looks too small to bother cancelling. Tracking them
as ordinary expenses does not work, because an expense is a thing that already happened — a
subscription is a commitment that will keep happening until you stop it.

### What it must do

1. **Track a subscription** — name, amount, currency, category, how often it renews, and an
   optional free trial.
2. **Renew automatically.** On each billing date the subscription writes a row into `expenses`
   for its amount and moves on to the next billing date. No button: the card is charged whether
   or not anyone opens the app, so the record follows the charge rather than waiting for a click.
3. **Remind for three days before each charge**, and before a free trial turns into one. Enough
   warning to cancel; the same reminder shows on each of the three days rather than stacking up.

Without the expense, a renewal is a date change that never reaches your spending totals, and
budgets silently under-report. The renewal is what makes a subscription real money. The
reminder is what keeps automatic renewal honest: a forgotten subscription surfaces before each
charge, not after.

### Data model

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK to `profiles.id` | cascade |
| `category_id` | uuid FK to `categories.id`, nullable | renewals inherit it |
| `name` | varchar(80) | "Spotify" |
| `amount` | numeric(20, 3) | what one renewal costs |
| `currency` | varchar(3) | |
| `interval_unit` | varchar(5) | `day` / `week` / `month` / `year`, CHECKed |
| `interval_count` | smallint, default 1 | every *N* units: quarterly is `month` × 3 |
| `started_on` | date | the day the user signed up |
| `trial_ends_on` | date, nullable | first paid charge when there is a free trial |
| `next_billing_on` | date | the next charge; maintained by the server |
| `cancelled_on` | date, nullable | set to cancel, may be in the future; null to resume |
| `note` | text, nullable | |
| `created_at` | timestamptz | |

The amount lives on the subscription, not on each renewal, because the user defines it once and
every renewal reuses it. When a price changes, the user edits the subscription and future
renewals pick up the new amount — past expense rows are historical fact and are never rewritten.

Renewal expenses are ordinary rows in `expenses` with no link back to the subscription, so the
expense table stays independent of this feature. They are told apart by category, which is why
every profile is seeded with a "Subscriptions" category. The server never picks it by name: an
omitted `category_id` means uncategorized, and the subscription form preselects the user's
category named "Subscriptions" (case-insensitive) when one exists. Renaming or deleting that
category therefore breaks nothing — the form simply has nothing to preselect.

Cancelling sets `cancelled_on` rather than deleting the row. A hard delete exists for mistakes;
expenses already written survive it.

### Billing dates

The first paid charge — the **anchor** — is `trial_ends_on` when there is a trial, otherwise
`started_on`. Every later charge is computed from the anchor, never from the previous charge:

```
charge k = anchor + k × (interval_count interval_units)
```

Month and year intervals clamp to the end of the month rather than overflowing: a subscription
anchored on 31 January bills on 28 February (29 in a leap year), not 3 March, and then on
31 March. Counting from the anchor is what keeps clamping from walking the date backwards a few
days every month. Day and week intervals need no clamping.

`next_billing_on` is stored rather than computed on read so the daily job is an indexed range
scan. It is recalculated as the first charge on or after today whenever the schedule changes —
interval, start, trial end, or cancellation — and otherwise only the renewal job moves it.

A subscription created with a start date in the past does **not** back-fill the charges before
today: the user has most likely recorded those already, and guessing would double-count.
Resuming a cancelled subscription likewise skips the charges it missed while cancelled.

"Today" is the user's today, in the timezone on their profile.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/finance/subscriptions` | List: live first, soonest charge first; cancelled last. |
| `POST` | `/finance/subscriptions` | Create. Omitted or `null` `category_id` means uncategorized. |
| `PATCH` | `/finance/subscriptions/{id}` | Edit — including amount, which affects future renewals only. |
| `DELETE` | `/finance/subscriptions/{id}` | Hard delete. Expenses already written survive. |

### Renewal job

A daily job finds every subscription with `next_billing_on <= today` that is not cancelled as of
that date, and for each one, in a **single transaction**:

1. writes an expense for the amount, in the subscription's currency and category, dated to the
   billing date it covers (not the day the job ran), and
2. advances `next_billing_on` to the following charge.

If the job missed days, it repeats this until `next_billing_on` is in the future, so each
missed charge is recorded against the period it belongs to and budgets for that period stay
accurate.

Doing both halves in one transaction is what makes the job safe to re-run: once a charge is
recorded, `next_billing_on` has already moved past it. A crash between the two must not leave a
charge that was never recorded, or an expense for a date that never advanced. Rows are locked
while processed so two overlapping runs cannot both take the same charge.

### Reminders

The same daily job raises a reminder for every live subscription whose next charge is within
**three days**, and for every trial ending within three days. It is one reminder per
subscription per billing date: shown on each of the three days, not created three times.

Delivery is in-app first, with email as a second channel for the same reminder. Budget breach
alerts must use the same mechanism; the two are not built twice.

### Open questions

- Which scheduler triggers the job — Supabase `pg_cron`, a GitHub Actions cron hitting a
  protected endpoint, or an in-process scheduler?
- Which email provider?

## Exchange rates

Rates live in `exchange_rates`, one row per currency (about 160 rows):

| Column | Type | Notes |
|---|---|---|
| `currency` | varchar(3), PK | |
| `rate_per_usd` | numeric(18, 6) | units of `currency` per 1 USD |
| `updated_at` | timestamptz | when the provider last quoted this rate |
| `delisted_at` | timestamptz, nullable | set when the provider stopped quoting it |

**The refresh job is the only writer.** Run daily by a scheduler —
`POST /api/v1/tasks/exchange-rates` or `python -m app.tasks exchange-rates`, see
[Background jobs](./platform.md#background-jobs) — it fetches open.er-api.com and, in one
transaction, updates or adds every currency it quotes. A failed run raises and leaves the table
as it was.

**The table is the list of supported currencies.** There is no hardcoded list: a currency is
supported while the provider quotes it. `GET /api/v1/finance/currencies` (the dropdowns) returns
the supported ones, and new expenses, budgets, subscriptions and profile currencies must use one
(`422 UNSUPPORTED_CURRENCY` otherwise).

**A currency the provider drops is delisted, not deleted.** The refresh sets `delisted_at` and
keeps the last rate, so:

- entries already recorded in it keep converting, at that last rate;
- it leaves the dropdowns, and new entries can't use it;
- a row already in it stays editable as long as its currency is left alone;
- if the provider quotes it again, the next refresh clears `delisted_at`.

A refresh that would delist more than 5 currencies at once is refused as a broken response
(`EXCHANGE_RATES_MAX_DELISTED_PER_REFRESH`).

**Reads never call the API.** They serve the table, cached in memory for an hour, however old
it is — stale real rates beat the hardcoded fallback — and log `exchange_rates.stale` once the
rows are more than 48 hours old, which means the scheduler has stopped. Before the job's first
run the table is empty: reads use the hardcoded fallback rates, and only those 10 currencies can
be picked. Run the job once right after deploying.

Only the latest rates are kept: totals convert at today's rate, so last January's total moves a
little as rates move. That is an accepted trade-off for a personal tracker.

---

## Requirements

### Built

- **[Core]** Expense logging — amount, currency, category, date, note. Full CRUD.
- **[Core]** Custom categories — CRUD, colour-coded.
- **[Core]** Budgets — named cap across one or more categories, monthly (resets each month) or
  over a custom date range, with a month picker for past months.
- **[Core]** Multi-currency with a per-user display currency and server-side conversion.
- **[Core]** Spending dashboard — category and period breakdowns, per-chart range picker,
  category filtering, two-range comparison.

### Planned

- **[v0.2]** Subscriptions — tracking with free trials, automatic renewal that writes an expense,
  reminders for three days before each charge.
- **[v0.2]** Budget breach alerts at configurable thresholds (default 80% / 100%).

### Future

- **[Future]** Income tracking, and with it a net position rather than gross spend.
- **[Future]** CSV import with column mapping and duplicate detection.
- **[Future]** Savings goals with progress tracking.

---

## Notes for implementers

- **The schema does not match older drafts of this documentation.** There is no
  `finance_transactions` table with an income/expense type and a payment method. The tables are
  `categories`, `expenses`, `budgets` and `budget_categories`. The column is `colour`, not `color`.
- **Budgets are many-to-many with categories** via `budget_categories`. Any code assuming one
  category per budget is wrong.
- **Never sum amounts without converting.** Expenses carry their own currency; adding raw amounts
  across currencies produces a number that means nothing. Conversion belongs in
  `services/finance/summaries.py`, server-side — the browser does not have a rate table.
