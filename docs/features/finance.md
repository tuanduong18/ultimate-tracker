# Finance & Budgeting

Track what you spend, cap it by category, and keep recurring costs from going unnoticed.
This is the first domain built, and it is complete: everything below is built.

The domain is about **understanding spending**, not about balances. Income and savings goals
are deliberately out of scope — see [Out of scope](#out-of-scope).

- **Release:** v0.1 (core), v0.2 (subscriptions, budget alerts); import shipped ahead of any release
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
- Transactions tab — every expense, searchable and filterable, exportable to Excel, and
  importable from a spreadsheet. See [Transactions](#transactions) and [Import](#import).
- Budgets — full CRUD. A budget is a named cap applied to **any number of categories**
  (many-to-many), of one of two kinds: **monthly**, which starts fresh every calendar month, or
  **custom**, over one fixed date range. See [Budgets](#budgets).
- Multi-currency — every expense and budget stores its own currency. Totals convert into the
  user's display currency server-side, using rates stored in the `exchange_rates` table by a
  daily scheduled job; requests never call open.er-api.com. The same table decides which
  currencies can be picked. See [Exchange rates](#exchange-rates).
- Budget progress — spend-to-date against each cap, converted.
- Budget alerts — a notification when a budget reaches its early warning (80% by default, or
  off) and when it reaches its cap, from an hourly scheduled job. See
  [Budget alerts](#budget-alerts).
- Breakdowns — spend by category and spend by period (day or week buckets), both filterable by
  category and comparable across two date ranges.
- Finance pages — tabs under the Finance title: **Overview** (summary tiles, the two comparison
  charts, the latest expenses and budget progress), **Transactions**, **Budgets**,
  **Subscriptions**, **Categories**. Expenses are added from the Add expense dialog beside the
  title, or the header's Log menu.
- Subscriptions — tracking with free trials, automatic renewal into expenses, reminders and
  renewal notices. Shipped ahead of its v0.2 slot. See [Subscriptions](#subscriptions).

### Out of scope

Decided on 2026-10-24, not deferred:

- **Income tracking**, and with it a net position. Your bank already shows what came in and
  what is left; this app is for understanding where the money goes, which the bank does not
  show. The domain stays expense-only — there is no income/expense type split.
- **Savings goals**, for the same reason: a balance-and-target question, which a bank answers
  better.

Revisit either only if the Insights domain finds a concrete use for it.

---

## Transactions

The Transactions tab (`/finance/expenses`) is the full list: every expense, newest first.

**Everything is filtered in the browser.** The tab fetches all of the user's expenses once,
walking `GET /finance/expenses` 500 rows at a time until a short page, then searches and
filters locally. One person's expenses stay in the thousands (a few a day is a thousand or two
a year), so filtering on the keystroke needs no request, and the backend stays plain CRUD.
Rows are drawn 50 at a time behind **Show N more**, with "Showing 50 of 312".

- **Search** works like Ctrl+F: one case-insensitive phrase, found anywhere in what a row shows
  — description, category name (including "Uncategorised", also matched as "Uncategorized"),
  the date as displayed and as `YYYY-MM-DD`, and the formatted amount. Each field is matched on
  its own, so a phrase never spans two.
- **Filters:** date (Any time, This month, Last month, Last 30 days, This year, or open-ended
  From / To), categories (with the uncategorised bucket switched separately), and amount. An
  amount range is always **in one currency** and compares amounts as recorded, never
  converted: "over 50" means different things in SGD and VND, and converting first would make
  which rows match drift with the exchange rate.
- **Summary line:** "12 of 312 transactions · S$120.00 + ₫50,000" — one exact total per
  currency, summed as decimal strings. Not converted: the browser has no rate table.
- **The URL holds the filters** (`?q=&from=&to=&category=&currency=&min=&max=`), so a filtered
  view survives a reload and can be bookmarked.

**Export to Excel** covers every matching row, not only the ones drawn. The tab posts the
filtered ids and the filters in words to `POST /finance/expenses/export`, which answers with an
`.xlsx` built by openpyxl:

- a **Transactions** sheet — Date, Description, Category, Amount, Currency and *Amount (display
  currency)* — with real date and number cells formatted to each currency's decimals, a frozen
  header and an autofilter. A row whose rate is missing leaves its converted cell blank rather
  than writing 0;
- an **About this export** sheet: when, how many rows, and the filters.

Sending ids rather than filters keeps the filter logic in one place, so the file cannot
disagree with the screen. Ids that are not the caller's, or no longer exist, are left out.
Every text cell is typed as a string, so a description beginning with `=` never becomes a
formula.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/finance/expenses` | Newest first. `?limit=` (1–500, default 100), `?offset=`, `?start_date=`, `?end_date=`. Ordered by `spent_on`, `created_at`, `id`, so paging never repeats or skips a row. |
| `POST` | `/finance/expenses` | Create. |
| `PATCH` | `/finance/expenses/{id}` | Partial update; explicit `null` clears `category_id` or `description`. |
| `DELETE` | `/finance/expenses/{id}` | `204`. |
| `POST` | `/finance/expenses/export` | Body `{"expense_ids": [...], "filters": ["Search: taxi", ...]}` (up to 50,000 ids, 20 filter lines). Answers `.xlsx` as an attachment, `transactions-YYYY-MM-DD.xlsx`. |

---

## Import

Expenses come in from a spreadsheet in three steps, all in one dialog behind **Import** on the
Transactions tab ([`services/finance/imports.py`](../../backend/app/services/finance/imports.py)):

1. **Download the template.** An `.xlsx` made for the user: an **Expenses** sheet with exactly the
   columns the importer reads, a **How to fill this in** sheet, and a hidden **Lists** sheet that
   feeds the drop-downs.
2. **Upload the filled-in file.** The server reads it and answers with a preview. Nothing is
   saved.
3. **Confirm.** The same file is sent again and imported in one transaction.

**Fixed columns, not a column-mapping step.** The template is the layout: `Date`, `Description`,
`Category`, `Amount`, `Currency` — the five the export leads with, in the same order, so **an
exported file imports as it is** (its extra converted-amount column is ignored). A bank statement
gets pasted into the template. Column names are matched however they are capitalised; other
columns are ignored; the first row with anything in it holds the names, and `Date` and `Amount`
are required.

**The template is personal.** The Category column's drop-down lists the user's own categories
(a warning, not a block, on a name that isn't one); the Currency column's lists the supported
currencies; Date and Amount cells check their type. It holds no example row — one left in by
mistake would be imported — the instructions sheet shows one instead.

| Column | Required | Read as |
|---|---|---|
| Date | Yes | A date cell, or text `2026-10-24` or `24/10/2026` — **day first**, never guessed: `05/10` read the wrong way round is a wrong expense nobody notices |
| Description | No | Up to 500 characters |
| Category | No | Matched to the user's categories however it is capitalised. A name they don't have is **created on import**, in the next unused colour of a fixed palette. Blank or "Uncategorised" is no category |
| Amount | Yes | A number cell, or text like `12.50`, `1,250.00`, `250000`. A comma is a thousands separator only where it groups three digits — `12,50` is refused, not read as 1,250. More than 0, within the currency's decimals |
| Currency | No | A supported code; blank is the profile's **preferred** currency |

**Files:** `.xlsx` (the first worksheet; formulas give their saved values) or CSV in UTF-8, with
or without Excel's BOM, delimited by `,`, `;` or tab — whichever the first line uses most. An
old `.xls` is refused with a message to save it as `.xlsx` or CSV. Caps: 5 MB and 5,000 rows,
refused outright rather than cut short, and an `.xlsx` that would unpack past 100 MB is refused
unread.

**Rows with problems are left out, not blocking.** The preview lists every problem by its
spreadsheet row number and column, in words ("“31/02/2026” isn’t a date…"); the rest can be
imported straight away, and the fixed file uploaded later.

**Duplicates** are rows with the same date, amount, currency and description (case and spaces
ignored) as an expense already recorded. Category is not compared: the file's may be newer.
They are matched **one for one** — two identical coffees in the file and one already saved
leaves one of the two as new — which is also what makes re-uploading a partly imported file
safe. Left out unless the user ticks them in.

The upload is the request body itself (`application/octet-stream`), read with a size cap as it
streams in; one file needs no multipart form.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/finance/expenses/import/template` | `.xlsx` attachment, `expenses-template.xlsx`. |
| `POST` | `/finance/expenses/import/preview` | Body: the file. Answers `{rows, problems}`: each row with `row` (spreadsheet number), the values as read, `new_category` and `duplicate`; each problem with `row`, `column` and `message`. Saves nothing. |
| `POST` | `/finance/expenses/import` | Body: the same file. `?include_duplicates=true` keeps duplicates. `201` with `{imported, duplicates_skipped, problem_rows_skipped, categories_created}`. |

A file that can't be read as a whole is `422 IMPORT_FILE_REJECTED` with a message written for
the person; over 5 MB is `413 IMPORT_FILE_TOO_LARGE`.

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

## Budget alerts

**Status: built. Release: v0.2.**
[`services/finance/budget_alerts.py`](../../backend/app/services/finance/budget_alerts.py), run
by the hourly `budgets` job ([Background jobs](./platform.md#background-jobs)) — never by a
request, so logging an expense does not itself send anything.

Each run measures every budget whose window holds the user's today exactly as the Budgets tab
does (`budget_progress`: the budget's own currency, its covered categories) and sends:

| Kind | When | Example |
|---|---|---|
| `budget_warning` | spend reaches `warn_at_percent` of the cap | "Food is 85% spent" — "SGD 340.00 of SGD 400.00 spent in October 2026, SGD 60.00 left." |
| `budget_exceeded` | spend reaches the cap | "Food is over budget" — "…SGD 12.50 over."; at exactly the cap, "Food is fully spent" |

- **The warning is per budget**: `warn_at_percent` on `budgets`, 1–99, **80 by default**, or
  null for none; the form offers 50, 75, 80 and 90%. Reaching the cap is always announced. A
  budget that jumps straight past its cap gets only the exceeded alert.
- **Once per window and cap.** The dedupe key is
  `budget:<id>:<window start>:<threshold>:<cap><currency>`: a monthly budget warns afresh every
  month, and raising a cap lets it warn again; a re-run sends nothing new.
- **An alert stays in the inbox while it still applies.** Each run moves to the history every
  inbox alert it would not send now — the warning once the exceeded alert supersedes it, and any
  alert whose budget was raised, deleted or spent less after an edit, or whose window ended. The
  same rule as currency notices. Spend that dips under a threshold and climbs back within the
  same window and cap is not announced twice.
- **Past windows are never alerted**: a backdated expense that pushes last month over is
  history, not news. A custom budget alerts only while its range holds today.
- **A missing exchange rate** skips that user for the run (logged as
  `budget_alerts.rate_unavailable`) and leaves their alerts as they were.
- Alerts are notices: fixed once sent, "Got it" moves one to the history, "View budgets" links to
  the tab. On each budget's bar, a notch marks where its warning fires.

---

## Subscriptions

**Status: built. Release: v0.2, shipped early.** Schema, CRUD service and routes, the renewal
job, reminders and renewal notices, scheduled by pg_cron in production.

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
3. **Remind three days before each charge**, and before a free trial turns into one, and keep
   the reminder open until the charge happens or the user acts on it. Enough warning to cancel.
   The lead time is a setting (`SUBSCRIPTION_REMINDER_LEAD_DAYS`); the reminder is sent once,
   not once per day.

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

**Built** ([`services/finance/renewals.py`](../../backend/app/services/finance/renewals.py)). The
`subscriptions` job finds every subscription whose `next_billing_on` has come in the user's
timezone and that is not cancelled as of that charge, and for each one, in a **single
transaction**:

1. writes an expense for the amount, in the subscription's currency and category, dated to the
   billing date it covers (not the day the job ran), with the subscription's name as its note;
2. replaces the charge's reminder with a renewal notice, "Netflix auto-renewed on 23 Oct — It
   cost USD 15.49" ("Your … trial ended on …" for a trial's first charge), in the inbox, or
   straight in the history when the user had snoozed the reminder;
3. advances `next_billing_on` to the following charge.

If the job missed days, it repeats this until `next_billing_on` is in the future, so each
missed charge is recorded against the period it belongs to and budgets for that period stay
accurate. Only the latest catch-up notice goes to the inbox; the rest go to the history.

Doing everything in one transaction is what makes the job safe to re-run: once a charge is
recorded, `next_billing_on` has already moved past it. The row is locked while processed
(`FOR UPDATE SKIP LOCKED`), so two overlapping runs cannot both take the same charge.

### Reminders

**Built** ([`services/finance/reminders.py`](../../backend/app/services/finance/reminders.py)).
One reminder per subscription per charge date, kept live from two sides through the same
`sync_reminder`:

- **The scheduled job** creates it **three days** before the charge, in the user's timezone, and
  rewrites its countdown each day — "Netflix renews in 3 days", "in 2 days", "tomorrow"; "Your …
  trial ends in …" when the charge is the end of a free trial. Each day's rewrite comes back
  unread, so the bell asks again, unless the reminder is snoozed.
- **An edit** to the subscription's name, amount, currency or schedule rewrites it at once, in
  the same transaction, and unsnoozes it. Moving the charge out of the three-day window removes
  it; cancelling on or before the charge, or deleting the subscription, deletes it. A new
  subscription due within three days gets its reminder as it is created.

**Snoozing** means "I'm renewing anyway": the reminder leaves the bell, keeps counting down
quietly in the history, and its renewal notice goes straight to the history too. **Unsnooze**
brings it back, for a mispress; so does editing the subscription.

The reminder is **deleted on its charge day** by the renewal job. A reminder left behind — a
charge a cancellation stopped — is cleaned up by the next run. No reminder is sent on the
charge day itself: a run that missed the window does not send a late one.

Delivery is in-app only for now. Email would be a second channel for the same notification row.
[Budget alerts](#budget-alerts) use the same mechanism; the two are not built twice.

### Open questions

- Which email provider? Resend is the working assumption. (The scheduler question is settled:
  Supabase pg_cron + pg_net — see [Background jobs](./platform.md#background-jobs).)

---

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

In the same run, the job sends an in-app notification (`currency_delisted`) to everyone with an
expense, budget or subscription in it, or with it as their display or preferred currency, once
per delisting. A refresh that would delist more than 5 currencies at once is refused as a broken
response (`EXCHANGE_RATES_MAX_DELISTED_PER_REFRESH`).

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
- **[Core]** Transactions — every expense, Ctrl+F-style search, date / category / amount
  filters, export of the matching rows to Excel.
- **[v0.2, shipped early]** Subscriptions — tracking with free trials, automatic renewal that
  writes an expense, a reminder three days before each charge that stays until acted on.
- **[v0.2]** Budget breach alerts — an early warning at a per-budget threshold (80% by default,
  or off) and an alert at the cap.
- **[Ahead of any release]** Import — a personal `.xlsx` template, `.xlsx` or CSV upload, a
  preview before anything is saved, duplicate detection, new categories created on import.
  Fixed template columns replaced the earlier plan of a column-mapping step.

### Planned

Nothing: Finance is complete for its release plan.

### Not planned

- Income tracking and savings goals — see [Out of scope](#out-of-scope).

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
- **An ORM `None` is not a NULL on insert.** SQLAlchemy leaves a `None` attribute out of the
  INSERT, so a column default fills it. `budgets.warn_at_percent` uses
  `SmallInteger().evaluates_none()` so "warning off" is stored as NULL rather than becoming 80.
  Any new nullable column with a default needs the same.
- **Two models with no relationship are inserted in no promised order.** The importer flushes new
  categories before adding the expenses that reference them; a test fixture adding a profile and
  its category together has to flush the profile first.
