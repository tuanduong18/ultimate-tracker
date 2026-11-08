import { formatDate, formatMonthShort } from '@/lib/dates';
import type { BudgetProgress } from '@/lib/finance/types';

/**
 * How a budget is described and measured on screen — the phone's copies of the helpers in the
 * web's budget-section.tsx and budget-form.tsx.
 */

/**
 * How full the bar is, 0–100. Floats are fine here: they size a mark, they total nothing. An
 * overspent budget is a full bar; the words beside it carry by how much.
 */
export function barPercent(spent: string, amount: string): number {
  const cap = Number(amount);
  const used = Number(spent);
  if (!Number.isFinite(cap) || !Number.isFinite(used) || cap <= 0) return 0;
  return Math.max(0, Math.min(100, (used / cap) * 100));
}

/** True once spending has passed the cap — `remaining` comes back negative. */
export function isOverspent(budget: Pick<BudgetProgress, 'remaining'>): boolean {
  return Number(budget.remaining) < 0;
}

/** "-12.50" → "12.50": "Overshooting" already says which way, so the figure needs no sign. */
export function withoutSign(amount: string): string {
  return amount.startsWith('-') ? amount.slice(1) : amount;
}

/**
 * When a budget applies: "1 Oct 2026 – 31 Oct 2026" for a custom one; "Since Oct 2026" or
 * "Oct 2026 – Dec 2026" for a monthly one, whose "Monthly" pill already says how often.
 */
export function scheduleOf(
  budget: Pick<BudgetProgress, 'period' | 'starts_on' | 'ends_on'>
): string {
  if (budget.period === 'custom') {
    return `${formatDate(budget.starts_on)} – ${formatDate(budget.ends_on ?? budget.starts_on)}`;
  }
  const from = formatMonthShort(budget.starts_on);
  return budget.ends_on ? `${from} – ${formatMonthShort(budget.ends_on)}` : `Since ${from}`;
}

/** The early-warning choices the form offers: a share of the cap, or none. */
export const WARN_AT = [50, 75, 80, 90] as const;

/** The default warning for a new budget, as on the web and the API. */
export const DEFAULT_WARN_AT = 80;

/**
 * The warning choices for a budget already warning at `current`: a value set elsewhere (the API
 * takes any 1–99) is offered alongside the usual four, in order, so editing never drops it.
 */
export function warnOptions(current: number | null): number[] {
  const usual: number[] = [...WARN_AT];
  return current !== null && !usual.includes(current)
    ? [...usual, current].sort((a, b) => a - b)
    : usual;
}
