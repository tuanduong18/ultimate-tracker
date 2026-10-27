/**
 * Shapes returned by /api/v1/finance.
 *
 * Every money field is a `string`, not a `number`, and that is deliberate on
 * the backend's side: a JSON number becomes a binary float here, and budget
 * arithmetic that is off by a cent is worse than a string we parse on purpose.
 * Format them with Intl.NumberFormat; if you ever need to add them, do it in
 * integer minor units rather than with parseFloat.
 */

export interface Category {
  id: string;
  name: string;
  /** Hex, e.g. "#22c55e". */
  colour: string;
  created_at: string;
}

export interface Expense {
  id: string;
  amount: string;
  currency: string;
  /** Null means uncategorised — the state left behind when a category is deleted. */
  category_id: string | null;
  description: string | null;
  /** ISO date, no time component. */
  spent_on: string;
  created_at: string;
}

/**
 * How a budget's window is measured.
 *
 * - `monthly`: a fresh cap every calendar month, from its first month until
 *   its last (or for good, when `ends_on` is null).
 * - `custom`: one fixed date range, measured in full.
 */
export type BudgetPeriod = 'monthly' | 'custom';

export interface Budget {
  id: string;
  name: string;
  amount: string;
  currency: string;
  period: BudgetPeriod;
  /** For a monthly budget, the 1st of its first month. */
  starts_on: string;
  /** Null for an ongoing monthly budget; always set for a custom one. */
  ends_on: string | null;
  /**
   * The share of the cap (1–99) at which an alert warns; null for no early
   * warning. Reaching the cap is announced either way.
   */
  warn_at_percent: number | null;
  /** Embedded by the API so a chart needs no second round trip. */
  categories: Category[];
  created_at: string;
}

export interface Summary {
  /** The profile's display currency; every total below is converted into it. */
  currency: string;
  starts_on: string;
  ends_on: string;
  spent: string;
  budgeted: string;
  /** Negative when overspent — show it, do not clamp it. */
  remaining: string;
}

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

/** One slice of the category pie: what a category cost over the range. */
export interface CategorySpend {
  /** Null for spend whose category was deleted — one bucket, still charted. */
  category_id: string | null;
  name: string;
  colour: string;
  spent: string;
}

export interface CategoryBreakdown {
  /** Every `spent` below is converted into this, server-side. */
  currency: string;
  starts_on: string;
  ends_on: string;
  /** Largest first; categories with no spend are left out entirely. */
  categories: CategorySpend[];
}

/** How wide one bar of the spending chart is. */
export type Granularity = 'day' | 'week';

/** One bar. A week bucket can be under seven days where the range clips it. */
export interface BucketSpend {
  starts_on: string;
  ends_on: string;
  spent: string;
}

export interface PeriodBreakdown {
  currency: string;
  starts_on: string;
  ends_on: string;
  /** Echoed by the API, so day bars cannot be mistaken for week bars. */
  granularity: Granularity;
  /** Date order, including buckets where nothing was spent. */
  buckets: BucketSpend[];
}

/**
 * A budget with spend measured against it.
 *
 * `currency` is the budget's own, not the display currency: spending is
 * converted into the cap so the percentage cannot drift with exchange rates.
 * Two rows in one list may therefore be quoted in different currencies.
 */
export interface BudgetProgress {
  id: string;
  name: string;
  currency: string;
  amount: string;
  spent: string;
  /** Negative when overspent — show it, do not clamp it. */
  remaining: string;
  period: BudgetPeriod;
  starts_on: string;
  ends_on: string | null;
  warn_at_percent: number | null;
  /**
   * The days `spent` covers: the requested month for a monthly budget, the
   * whole range for a custom one.
   */
  window_starts_on: string;
  window_ends_on: string;
  categories: Category[];
  /** Orders the card colours, so adding a budget does not recolour the rest. */
  created_at: string;
}

/** One expense an import file would add, as the server read it. */
export interface ImportRow {
  /** The row number the spreadsheet shows. */
  row: number;
  spent_on: string;
  description: string | null;
  /** An existing category's own name, or a new one as the file spells it; null is uncategorised. */
  category: string | null;
  /** Importing this row creates the category. */
  new_category: boolean;
  amount: string;
  currency: string;
  /** Matches an expense already recorded: same date, amount, currency and description. */
  duplicate: boolean;
}

/** Why one cell keeps its row out of an import. */
export interface ImportProblem {
  row: number;
  column: string;
  message: string;
}

/** What importing a file would do. Nothing has been saved. */
export interface ImportPreview {
  /** File order; duplicates included, flagged. */
  rows: ImportRow[];
  /** One per problem; a row can have more than one. */
  problems: ImportProblem[];
}

export interface ImportResult {
  imported: number;
  duplicates_skipped: number;
  /** Rows, not problems. */
  problem_rows_skipped: number;
  categories_created: string[];
}

/** The unit of a subscription's billing cycle; paired with `interval_count`. */
export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface Subscription {
  id: string;
  name: string;
  amount: string;
  currency: string;
  interval_unit: BillingInterval;
  /** "Every N units": quarterly is month × 3. */
  interval_count: number;
  /** Null means uncategorised. The server never picks one by name. */
  category_id: string | null;
  started_on: string;
  /** When set, the first charge falls on this day rather than started_on. */
  trial_ends_on: string | null;
  /** The next charge. Computed by the server; read-only here. */
  next_billing_on: string;
  /** Set to cancel, possibly in the future for a fixed-term plan. */
  cancelled_on: string | null;
  note: string | null;
  created_at: string;
}

/** "month" or "3 months" — how often a subscription bills, for "every …" and "/ …". */
export function formatInterval(unit: BillingInterval, count: number): string {
  return count === 1 ? unit : `${count} ${unit}s`;
}
