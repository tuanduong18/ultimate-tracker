# Finance & Budgeting

Track what you spend, cap it by category, and keep recurring costs from going unnoticed.
This is the first domain built and the most complete.

- **Release:** v0.1 (core), v0.2 (subscriptions)
- **Scope name:** `finance`
- **API prefix:** `/api/v1/finance`
- **Code:** [`backend/app/api/v1/finance.py`](../../backend/app/api/v1/finance.py) ·
  [`services/finance.py`](../../backend/app/services/finance.py) ·
  [`models/finance.py`](../../backend/app/models/finance.py)

---

## Status

**Built:**

- Categories — full CRUD, each with a name and a colour.
- Expenses — full CRUD, each with its own currency, amount, optional category, date and note.
- Budgets — full CRUD. A budget is a named cap over an explicit date range, applied to
  **any number of categories** (many-to-many), not a single category on a fixed weekly/monthly cycle.
- Multi-currency — every expense and budget stores its own currency. Totals convert into the
  user's display currency server-side, using rates from open.er-api.com cached for 6 hours.
- Budget progress — spend-to-date against each cap, converted.
- Breakdowns — spend by category and spend by period (day or week buckets), both filterable by
  category and comparable across two date ranges.
- Finance dashboard — four panels: two comparison charts over a categories / expenses / budgets row.

**Not built:**

- Subscriptions (all of it — see below).
- Budget breach alerts. Progress is calculated and displayed; nothing notifies you.
- Income. The domain is expense-only today; there is no income/expense type split.
- CSV import, savings goals.

---

## Subscriptions

**Status: not started. Release: v0.2 — the whole feature in one release, reminders included.**

Recurring costs are the spending that hurts most and gets watched least: they are invisible
between renewals, and each one individually looks too small to bother cancelling. Tracking them
as ordinary expenses does not work, because an expense is a thing that already happened — a
subscription is a commitment that will keep happening until you stop it.

### What it must do

1. **Track a subscription** — name, amount, currency, category, and how often it renews.
2. **Remind, one day before the current period ends.** Enough warning to cancel; not so much
   that the reminder gets dismissed and forgotten.
3. **Renew with one button.** Pressing it does two things atomically:
   - rolls the current period forward to the next one, and
   - writes a new row into `expenses` for the subscription's amount.

That second half is the point. Without it, a renewed subscription is a date change that never
reaches your spending totals, and budgets silently under-report. The renewal is what makes a
subscription real money.

### Data model

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK to `profiles.id` | |
| `category_id` | uuid FK to `categories.id`, nullable | renewals inherit it |
| `name` | varchar(80) | "Spotify" |
| `amount` | numeric | what one renewal costs |
| `currency` | varchar(3) | |
| `cadence` | varchar | `weekly` / `monthly` / `quarterly` / `yearly` / `custom` |
| `cadence_days` | int, nullable | only when cadence is `custom` |
| `current_period_start` | date | inclusive |
| `current_period_end` | date | inclusive — the last day covered |
| `reminder_days_before` | int, default 1 | |
| `reminder_enabled` | bool, default true | |
| `active` | bool, default true | |
| `cancelled_on` | date, nullable | |
| `created_at` | timestamptz | |

The amount lives on the subscription, not on each renewal, because the user defines it once and
every renewal reuses it. When a price changes, the user edits the subscription and future
renewals pick up the new amount — past expense rows are historical fact and are never rewritten.

`category_id` is nullable for the same reason it is nullable on expenses, and it matters more
here: a renewal inherits the subscription's category, so setting it once is what makes
subscription spend appear correctly in the category breakdown and count against budgets.

### Period arithmetic

Periods are **inclusive on both ends**, matching `budgets.starts_on` / `ends_on`. A renewal sets:

```
new_start = old_end + 1 day
new_end   = new_start + one cadence - 1 day
```

Month and year cadences clamp to the end of the month rather than overflowing: a subscription
whose period ends 31 January renews to 28 February (29 in a leap year), not 3 March. A period
anchored to the 31st keeps renewing on month-end thereafter — clamping must not silently walk
the renewal date backwards a few days every month.

A `custom` cadence uses `cadence_days` and needs no clamping.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/finance/subscriptions` | List. `?active=true` hides cancelled ones. |
| `POST` | `/finance/subscriptions` | Create. |
| `PATCH` | `/finance/subscriptions/{id}` | Edit — including amount, which affects future renewals only. |
| `DELETE` | `/finance/subscriptions/{id}` | Hard delete. Expenses already written survive. |
| `POST` | `/finance/subscriptions/{id}/renew` | The renew button. Advances the period **and** creates the expense, in one transaction. |
| `GET` | `/finance/subscriptions/upcoming` | Renewing within N days — feeds the dashboard and the reminder job. |

### Renewal must be idempotent

A double-clicked renew button must not produce two expense rows and skip two periods. The
endpoint takes the period the client believes is current and refuses if that is not the period
on the record:

```json
{
  "error": {
    "code": "SUBSCRIPTION_PERIOD_STALE",
    "message": "This subscription has already been renewed."
  }
}
```

A client-supplied idempotency key would also work, but the period is data the client already
holds, and it prevents the exact failure that matters.

Renewal writes the expense **and** advances the period in a single transaction. A crash between
the two halves must not leave a charged period that was never recorded, or an expense for a
period that never advanced.

### Reminders

The reminder is a scheduled job, which is why this feature waits for v0.2 rather than riding
along with the rest of Finance in v0.1 — there is no scheduler before then. The job runs daily,
finds subscriptions where `current_period_end` minus `reminder_days_before` is today and
reminders are enabled, and delivers one notification per subscription per period.

Delivery reuses whatever channel budget breach alerts use; the two must not be built twice. The
reminder carries the renew action, so the path from "this renews tomorrow" to a recorded expense
is one click.

**A reminder is not a renewal.** Nothing renews on its own. The user presses the button — an
unrenewed subscription shows as overdue, which is the honest state, and is also how a
cancelled-but-forgotten subscription surfaces.

### Open questions

- Should an overdue subscription keep reminding, or remind once and then sit in an overdue state?
  Leaning toward once — daily nagging trains dismissal.
- Should renewing an overdue subscription date the expense to the period it covers, or to today?
  Leaning toward the period it covers, so budgets for that period stay accurate.

---

## Requirements

### Built

- **[Core]** Expense logging — amount, currency, category, date, note. Full CRUD.
- **[Core]** Custom categories — CRUD, colour-coded.
- **[Core]** Budgets — named cap over an explicit date range across one or more categories.
- **[Core]** Multi-currency with a per-user display currency and server-side conversion.
- **[Core]** Spending dashboard — category and period breakdowns, per-chart range picker,
  category filtering, two-range comparison.

### Planned

- **[v0.2]** Subscriptions — tracking, one-day-before reminders, one-click renew that writes an expense.
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
  `services/finance.py`, server-side — the browser does not have a rate table.
