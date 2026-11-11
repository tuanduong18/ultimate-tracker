/**
 * Shapes returned by /api/v1/finance.
 *
 * The fields and their types are not written here: they come from the backend's own schema,
 * through lib/types/api.gen.ts — the same generated file the web imports — and are only named
 * here. A field the backend adds, renames or retypes therefore fails the type check on both
 * clients instead of drifting. What is written here is what a schema cannot say: what a field
 * means and how to treat it.
 *
 * Every money field is a `string`, not a `number`, on the backend's side and deliberately: a
 * JSON number becomes a binary float here, and budget arithmetic that is off by a cent is worse
 * than a string we parse on purpose. Show them with `formatMoney` and add them with
 * `sumAmounts` (lib/money.ts), never with parseFloat.
 */
import type * as Api from '@/lib/types/api.gen';

/**
 * - `colour`: hex, e.g. "#22c55e". The same in light and dark: a category's colour is its
 *   identity.
 * - `icon`: a key from the shared symbol list ("food"), drawn by `symbolFor` in
 *   lib/finance/category-symbols.ts; null when none was picked, and then the badge shows the
 *   category's initial.
 */
export type Category = Api.CategoryRead;

/**
 * - `category_id`: null means uncategorised — the state left behind when a category is deleted.
 * - `spent_on`: an ISO date, no time component.
 */
export type Expense = Api.ExpenseRead;

/**
 * How a budget's window is measured.
 *
 * - `monthly`: a fresh cap every calendar month, from its first month until its last (or for
 *   good, when `ends_on` is null).
 * - `custom`: one fixed date range, measured in full.
 */
export type BudgetPeriod = Api.BudgetPeriod;

/**
 * A budget as stored — what /budgets returns, and what the edit form starts from.
 *
 * - `starts_on`: for a monthly budget, the 1st of its first month.
 * - `ends_on`: null for an ongoing monthly budget; always set for a custom one.
 * - `categories`: embedded by the API; empty when `all_spending`.
 */
export type Budget = Api.BudgetRead;

/**
 * A budget with spend measured against it — what /budgets/progress returns for one month.
 *
 * `currency` is the budget's own, not the display currency: spending is converted into the cap
 * so the percentage cannot drift with exchange rates. Two rows in one list may therefore be
 * quoted in different currencies.
 *
 * - `remaining`: negative when overspent — show it, do not clamp it.
 * - `starts_on`: for a monthly budget, the 1st of its first month.
 * - `ends_on`: null for an ongoing monthly budget; always set for a custom one.
 * - `warn_at_percent`: the share of the cap (1–99) at which an alert warns; null for no early
 *   warning. Reaching the cap is announced either way.
 * - `window_starts_on`, `window_ends_on`: the days `spent` covers — the month asked for, or a
 *   custom budget's whole range.
 * - `all_spending`: covers every expense — any category, ones made later, and none — rather
 *   than a chosen set. `categories` is then empty.
 * - `created_at`: orders the card colours, so adding or arranging a budget does not recolour
 *   the rest.
 */
export type BudgetProgress = Api.BudgetProgressRead;

/**
 * - `currency`: the profile's display currency; every total is converted into it.
 * - `remaining`: negative when overspent — show it, do not clamp it.
 */
export type Summary = Api.SummaryRead;

/**
 * One slice of the category ring: what a category cost over the range.
 *
 * - `category_id`: null for spend whose category was deleted — one bucket, still charted.
 */
export type CategorySpend = Api.CategorySpendRead;

/**
 * - `currency`: every `spent` is converted into this, server-side.
 * - `categories`: largest first; categories with no spend are left out entirely.
 */
export type CategoryBreakdown = Api.CategoryBreakdownRead;

/** How wide one bar of the spending chart is. */
export type Granularity = Api.PeriodBreakdownRead['granularity'];

/** One bar. A week bucket can be under seven days where the range clips it. */
export type BucketSpend = Api.BucketSpendRead;

/**
 * - `granularity`: echoed by the API, so day bars cannot be mistaken for week bars.
 * - `buckets`: date order, including buckets where nothing was spent.
 */
export type PeriodBreakdown = Api.PeriodBreakdownRead;

/** The unit of a subscription's billing cycle; paired with `interval_count`. */
export type BillingInterval = Api.BillingInterval;

/**
 * - `interval_count`: "every N units" — quarterly is month × 3.
 * - `category_id`: null means uncategorised. The server never picks one by name.
 * - `trial_ends_on`: when set, the first charge falls on this day rather than `started_on`.
 * - `next_billing_on`: the next charge. Computed by the server; read-only here.
 * - `cancelled_on`: set to cancel, possibly in the future for a fixed-term plan.
 */
export type Subscription = Api.SubscriptionRead;

/**
 * One expense a spreadsheet would import, as the server read it.
 *
 * - `row`: the row number the spreadsheet shows.
 * - `category`: an existing category's own name, or a new one as the file spells it; null is
 *   uncategorised.
 * - `new_category`: importing this row creates the category.
 * - `duplicate`: matches an expense already recorded — same date, amount, currency and
 *   description.
 */
export type ImportRow = Api.ImportRowRead;

/** Why one cell keeps its row out of an import. */
export type ImportProblem = Api.ImportProblemRead;

/**
 * What importing a file would do. Nothing has been saved.
 *
 * - `rows`: file order; duplicates included, flagged.
 * - `problems`: one per problem; a row can have more than one.
 */
export type ImportPreview = Api.ExpenseImportPreviewRead;

/** `problem_rows_skipped` counts rows, not problems. */
export type ImportResult = Api.ExpenseImportResultRead;
