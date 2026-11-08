import { daysUntil, formatSpan, rangeLength, type DateRange } from '@/lib/dates';
import { isLive } from '@/lib/finance/subscriptions';
import type { CategoryBreakdown, Granularity, Subscription } from '@/lib/finance/types';
import { sumAmounts } from '@/lib/money';
import { NEUTRAL_COLOUR } from '@/lib/tint';

/**
 * The arithmetic behind the Overview's tiles and charts — the phone's copies of the helpers in
 * the web's summary-tiles.tsx, spend-by-category-chart.tsx and range-control.tsx, so both clients
 * draw the same slices and say the same thing about them.
 */

/**
 * How "Spent this month" compares with the same days of last month, in words, and which way it
 * went. `trend` is null for the neutral lines; for spending, down is good — the tile pairs the
 * colour with an arrow and the words, never colour alone.
 */
export function spendingChange(
  spent: string,
  spentBefore: string,
  before: DateRange
): { text: string; trend: 'down' | 'up' | null } {
  const versus = formatSpan(before.start, before.end);
  const was = Number(spentBefore);
  const is = Number(spent);
  // A month with nothing in it yet is not a 100% saving; it is just early.
  if (is === 0) return { text: 'Nothing spent yet this month', trend: null };
  if (was > 0 && Number.isFinite(is)) {
    const change = Math.round(((is - was) / was) * 100);
    if (change === 0) return { text: `Level with ${versus}`, trend: null };
    const down = change < 0;
    return {
      text: `${Math.abs(change)}% ${down ? 'less' : 'more'} than ${versus}`,
      trend: down ? 'down' : 'up',
    };
  }
  return { text: `Nothing spent ${versus}`, trend: null };
}

/** The soonest charge still to come, and how many land in the next 30 days. */
export function nextRenewal(
  subscriptions: readonly Subscription[],
  today: string
): { next: Subscription | null; withinMonth: number } {
  const upcoming = subscriptions
    .filter((s) => isLive(s, today) && s.next_billing_on >= today)
    .sort((a, b) => a.next_billing_on.localeCompare(b.next_billing_on));
  return {
    next: upcoming[0] ?? null,
    withinMonth: upcoming.filter((s) => daysUntil(s.next_billing_on, today) <= 30).length,
  };
}

/** Bars by day for a month or less, by week beyond — so a bar is never a sliver. */
export function granularityFor(range: DateRange): Granularity {
  return rangeLength(range) <= 31 ? 'day' : 'week';
}

/** Named slices before the rest fold into "Others (n)" — five marks in all, the most a ring holds. */
export const NAMED_ROWS = 4;

/** The fold's colour: lighter than the Uncategorised neutral, so the two never read as one. */
export const OTHERS_COLOUR = '#cbd5e1';

/** One category's spend in the period before and the one shown, for the ring and its legend. */
export interface CategoryRow {
  key: string;
  name: string;
  colour: string;
  previousSpent: string;
  currentSpent: string;
}

/**
 * Both periods' categories as one list, biggest now first, with the tail folded into
 * "Others (n)" once there are more than five.
 *
 * Uncategorised is drawn in the shared neutral rather than the colour the API sends for it, so
 * it matches every other place that bucket appears. A category with nothing in either period is
 * left out. A single leftover row is shown by name: folding one row into "Others (1)" hides its
 * name and saves nothing.
 */
export function toRows(
  previous: CategoryBreakdown | null | undefined,
  current: CategoryBreakdown | null | undefined
): CategoryRow[] {
  const rows = new Map<string, CategoryRow>();
  const add = (
    breakdown: CategoryBreakdown | null | undefined,
    side: 'previousSpent' | 'currentSpent'
  ) => {
    for (const entry of breakdown?.categories ?? []) {
      const key = entry.category_id ?? 'uncategorised';
      const existing = rows.get(key) ?? {
        key,
        name: entry.name,
        colour: entry.category_id === null ? NEUTRAL_COLOUR : entry.colour,
        previousSpent: '0',
        currentSpent: '0',
      };
      rows.set(key, { ...existing, [side]: entry.spent });
    }
  };
  add(previous, 'previousSpent');
  add(current, 'currentSpent');

  const ranked = [...rows.values()]
    .filter((row) => Number(row.previousSpent) > 0 || Number(row.currentSpent) > 0)
    .sort(
      (a, b) =>
        Number(b.currentSpent) - Number(a.currentSpent) ||
        Number(b.previousSpent) - Number(a.previousSpent) ||
        a.name.localeCompare(b.name)
    );

  if (ranked.length <= NAMED_ROWS + 1) return ranked;
  const rest = ranked.slice(NAMED_ROWS);
  return [
    ...ranked.slice(0, NAMED_ROWS),
    {
      key: 'others',
      name: `Others (${rest.length})`,
      colour: OTHERS_COLOUR,
      previousSpent: sumAmounts(rest.map((row) => row.previousSpent)),
      currentSpent: sumAmounts(rest.map((row) => row.currentSpent)),
    },
  ];
}

/** A row's whole-number share of a period's total; 0 when nothing was spent at all. */
export function share(spent: string, total: string): number {
  const all = Number(total);
  return all > 0 ? Math.round((Number(spent) / all) * 100) : 0;
}
