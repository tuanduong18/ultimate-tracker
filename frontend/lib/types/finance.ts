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

export interface Budget {
  id: string;
  name: string;
  amount: string;
  currency: string;
  starts_on: string;
  ends_on: string;
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

/** Render a backend money string in its own currency. */
export function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
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
