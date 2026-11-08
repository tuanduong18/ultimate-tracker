/**
 * Shapes returned by /api/v1/finance — the phone's copy of frontend/lib/types/finance.ts, so
 * both clients read the API the same way. Change one, change the other.
 *
 * Every money field is a `string`, not a `number`, on the backend's side and deliberately: a
 * JSON number becomes a binary float here, and budget arithmetic that is off by a cent is worse
 * than a string we parse on purpose. Show them with `formatMoney` and add them with
 * `sumAmounts` (lib/money.ts), never with parseFloat.
 */

export interface Category {
  id: string;
  name: string;
  /** Hex, e.g. "#22c55e". The same in light and dark: a category's colour is its identity. */
  colour: string;
  /**
   * A key from the shared symbol list ("food"), drawn by `symbolFor` in
   * lib/finance/category-symbols.ts; null when none was picked, and then the badge shows the
   * category's initial.
   */
  icon: string | null;
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
 * - `monthly`: a fresh cap every calendar month, from its first month until its last (or for
 *   good, when `ends_on` is null).
 * - `custom`: one fixed date range, measured in full.
 */
export type BudgetPeriod = 'monthly' | 'custom';

/** A budget as stored — what /budgets returns, and what the edit form starts from. */
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
  warn_at_percent: number | null;
  all_spending: boolean;
  /** Embedded by the API; empty when `all_spending`. */
  categories: Category[];
  created_at: string;
}

/**
 * A budget with spend measured against it — what /budgets/progress returns for one month.
 *
 * `currency` is the budget's own, not the display currency: spending is converted into the cap
 * so the percentage cannot drift with exchange rates. Two rows in one list may therefore be
 * quoted in different currencies.
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
  /** For a monthly budget, the 1st of its first month. */
  starts_on: string;
  /** Null for an ongoing monthly budget; always set for a custom one. */
  ends_on: string | null;
  /**
   * The share of the cap (1–99) at which an alert warns; null for no early warning. Reaching
   * the cap is announced either way.
   */
  warn_at_percent: number | null;
  /** The days `spent` covers: the month asked for, or a custom budget's whole range. */
  window_starts_on: string;
  window_ends_on: string;
  /**
   * Covers every expense — any category, ones made later, and none — rather than a chosen set.
   * `categories` is then empty.
   */
  all_spending: boolean;
  categories: Category[];
  /** Orders the card colours, so adding or arranging a budget does not recolour the rest. */
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

/** One slice of the category ring: what a category cost over the range. */
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
