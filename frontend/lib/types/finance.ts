/**
 * Shapes returned by /api/v1/finance.
 *
 * The fields and their types are not written here: they come from the
 * backend's own schema, through api.gen.ts, and are only named here. A field
 * the backend adds, renames or retypes therefore fails the type check instead
 * of drifting. What is written here is what a schema cannot say — what a field
 * means and how to treat it.
 *
 * Every money field is a `string`, not a `number`, and that is deliberate on
 * the backend's side: a JSON number becomes a binary float here, and budget
 * arithmetic that is off by a cent is worse than a string we parse on purpose.
 * Format them with Intl.NumberFormat; if you ever need to add them, do it in
 * integer minor units rather than with parseFloat.
 */
import type * as Api from '@/lib/types/api.gen';

/**
 * - `colour`: hex, e.g. "#22c55e".
 * - `icon`: a key from the shared symbol list ("food"), drawn by `symbolFor` in
 *   lib/category-symbols.ts; null when none was picked, and then the badge
 *   shows the category's initial.
 */
export type Category = Api.CategoryRead;

/**
 * - `category_id`: null means uncategorised — the state left behind when a
 *   category is deleted.
 * - `spent_on`: an ISO date, no time component.
 */
export type Expense = Api.ExpenseRead;

/**
 * How a budget's window is measured.
 *
 * - `monthly`: a fresh cap every calendar month, from its first month until
 *   its last (or for good, when `ends_on` is null).
 * - `custom`: one fixed date range, measured in full.
 */
export type BudgetPeriod = Api.BudgetPeriod;

/**
 * - `starts_on`: for a monthly budget, the 1st of its first month.
 * - `ends_on`: null for an ongoing monthly budget; always set for a custom one.
 * - `warn_at_percent`: the share of the cap (1–99) at which an alert warns;
 *   null for no early warning. Reaching the cap is announced either way.
 * - `all_spending`: covers every expense — any category, ones made later, and
 *   none — rather than a chosen set. `categories` is then empty.
 * - `categories`: embedded by the API so a chart needs no second round trip.
 */
export type Budget = Api.BudgetRead;

/**
 * - `currency`: the profile's display currency; every total is converted into it.
 * - `remaining`: negative when overspent — show it, do not clamp it.
 */
export type Summary = Api.SummaryRead;

/**
 * One formatter per currency, made on first use.
 *
 * Building an Intl.NumberFormat is far slower than using one, and a list of
 * expenses asks for the same handful of currencies on every row and every
 * render. Keyed by currency alone because the locale is always the browser's.
 */
const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string): Intl.NumberFormat {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    moneyFormats.set(currency, format);
  }
  return format;
}

/** Render a backend money string in its own currency. */
export function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return moneyFormat(currency).format(value);
  } catch {
    // Intl throws on codes it does not know; the raw figure still beats nothing.
    return `${amount} ${currency}`;
  }
}

/**
 * Reject locally only what is wrong for *any* currency.
 *
 * How many decimals a currency actually allows (0 for VND, 3 for KWD) is the
 * backend's call — it owns the minor-units table, and duplicating that here is
 * how the two drift apart. This catches the typo; the API catches the rest, and
 * `describeError` turns its answer into a sentence.
 */
export function amountProblem(raw: string): string | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Enter an amount like 12.50.';
  if (Number(value) <= 0) return 'The amount must be more than zero.';
  return null;
}

/**
 * One slice of the category pie: what a category cost over the range.
 *
 * - `category_id`: null for spend whose category was deleted — one bucket,
 *   still charted.
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

/**
 * A budget with spend measured against it.
 *
 * `currency` is the budget's own, not the display currency: spending is
 * converted into the cap so the percentage cannot drift with exchange rates.
 * Two rows in one list may therefore be quoted in different currencies.
 *
 * - `remaining`: negative when overspent — show it, do not clamp it.
 * - `window_starts_on`, `window_ends_on`: the days `spent` covers — the
 *   requested month for a monthly budget, the whole range for a custom one.
 * - `all_spending`: see `Budget`; `categories` is empty when it is true.
 * - `created_at`: orders the card colours, so adding a budget does not
 *   recolour the rest.
 */
export type BudgetProgress = Api.BudgetProgressRead;

/**
 * One expense an import file would add, as the server read it.
 *
 * - `row`: the row number the spreadsheet shows.
 * - `category`: an existing category's own name, or a new one as the file
 *   spells it; null is uncategorised.
 * - `new_category`: importing this row creates the category.
 * - `duplicate`: matches an expense already recorded — same date, amount,
 *   currency and description.
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

/** The unit of a subscription's billing cycle; paired with `interval_count`. */
export type BillingInterval = Api.BillingInterval;

/**
 * - `interval_count`: "every N units" — quarterly is month × 3.
 * - `category_id`: null means uncategorised. The server never picks one by name.
 * - `trial_ends_on`: when set, the first charge falls on this day rather than
 *   `started_on`.
 * - `next_billing_on`: the next charge. Computed by the server; read-only here.
 * - `cancelled_on`: set to cancel, possibly in the future for a fixed-term plan.
 */
export type Subscription = Api.SubscriptionRead;

/** "month" or "3 months" — how often a subscription bills, for "every …" and "/ …". */
export function formatInterval(unit: BillingInterval, count: number): string {
  return count === 1 ? unit : `${count} ${unit}s`;
}
