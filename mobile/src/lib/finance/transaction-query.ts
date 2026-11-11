import {
  formatDate,
  formatRange,
  monthRange,
  shiftMonth,
  toIsoDate,
  type DateRange,
} from '@/lib/dates';
import { ALL_CATEGORIES, UNCATEGORISED, type CategorySelection } from '@/lib/finance/categories';
import type { Category, Expense } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';

/**
 * What the Transactions screen is narrowed to, and how a row is tested against it — the phone's
 * copy of frontend/components/finance/transaction-query.ts, without the URL half (a phone screen
 * has no address bar to bookmark).
 *
 * Filtering happens here, on the phone, over every expense: a person logs a few a day, so even
 * years of them is a list the phone holds easily, and a filter that runs locally answers on the
 * keystroke instead of after a round trip.
 *
 * Kept as the strings the fields hold, not parsed values: an amount someone is halfway through
 * typing ("12.") has to survive a re-render.
 */
export interface TransactionFilters {
  /** Free text, found like a page search in anything a row shows — see rowText. */
  q: string;
  /** YYYY-MM-DD, or '' for open-ended on that side. */
  start: string;
  end: string;
  categories: CategorySelection;
  /** '' for any currency. Set whenever min or max is. */
  currency: string;
  min: string;
  max: string;
}

export const NO_FILTERS: TransactionFilters = {
  q: '',
  start: '',
  end: '',
  categories: ALL_CATEGORIES,
  currency: '',
  min: '',
  max: '',
};

/**
 * A typed bound as a plain decimal, or null when it is not a number yet. Forgiving on purpose:
 * "1,200", " 12.5 " and "$40" all mean something.
 */
export function readAmount(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/[,\s]/g, '')
    .replace(/^[^\d.]+/, '');
  if (value === '') return null;
  return /^\d+(\.\d+)?$/.test(value) ? value : null;
}

/** A typed bound that is ignored until fixed — worth saying so beside it. */
export function amountUnreadable(raw: string): boolean {
  return raw.trim() !== '' && readAmount(raw) === null;
}

/** "At most" below "at least": the upper bound is ignored rather than matching nothing. */
export function boundsInverted(filters: TransactionFilters): boolean {
  const min = readAmount(filters.min);
  const max = readAmount(filters.max);
  return min !== null && max !== null && Number(max) < Number(min);
}

/**
 * The text a row shows, one entry per field, lower-cased for matching. Whatever someone can read
 * on a row, they can find it by — including "Uncategorised", a label the row draws rather than
 * data, and the date and amount as written on screen. Fields stay apart so a search cannot match
 * across the gap between two of them.
 */
function rowText(expense: Expense, names: Map<string, string>): string[] {
  const category = (expense.category_id && names.get(expense.category_id)) || UNCATEGORISED;
  const fields = [
    expense.description ?? '',
    category,
    formatDate(expense.spent_on),
    expense.spent_on,
    formatMoney(expense.amount, expense.currency),
  ];
  // The app spells it the British way; someone searching the American way wants the same rows.
  if (category === UNCATEGORISED) fields.push('Uncategorized');
  return fields.map((field) => field.toLocaleLowerCase());
}

/**
 * Build the test for one set of filters, to run over every row.
 *
 * Amounts are compared as recorded, in the filter's currency — never converted, which would make
 * which rows match drift with the exchange rate. Comparing through Number is safe here: it decides
 * order, it sums nothing.
 */
export function matcher(
  filters: TransactionFilters,
  categories: readonly Category[]
): (expense: Expense) => boolean {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const phrase = filters.q.trim().toLocaleLowerCase();
  const ids = filters.categories.ids === null ? null : new Set(filters.categories.ids);
  const min = filters.currency ? readAmount(filters.min) : null;
  const max = filters.currency && !boundsInverted(filters) ? readAmount(filters.max) : null;

  return (expense) => {
    if (filters.start && expense.spent_on < filters.start) return false;
    if (filters.end && expense.spent_on > filters.end) return false;

    if (expense.category_id === null) {
      if (!filters.categories.uncategorized) return false;
    } else if (ids !== null && !ids.has(expense.category_id)) {
      return false;
    }

    if (filters.currency && expense.currency !== filters.currency) return false;
    if (min !== null && Number(expense.amount) < Number(min)) return false;
    if (max !== null && Number(expense.amount) > Number(max)) return false;

    if (phrase && !rowText(expense, names).some((field) => field.includes(phrase))) {
      return false;
    }
    return true;
  };
}

/** True when the date filter narrows anything. */
export function datesFiltered(filters: TransactionFilters): boolean {
  return filters.start !== '' || filters.end !== '';
}

/** True when anything narrows the list — what decides whether "Clear filters" shows. */
export function isFiltered(filters: TransactionFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    datesFiltered(filters) ||
    filters.categories.ids !== null ||
    !filters.categories.uncategorized ||
    filters.currency !== ''
  );
}

/**
 * The date presets. "Last 30 days" rather than "last week": the question people bring to a list
 * of transactions is usually "around when did I pay that".
 */
export function datePresets(today: Date = new Date()): { label: string; range: DateRange }[] {
  const thisMonth = monthRange(today);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  return [
    { label: 'This month', range: thisMonth },
    {
      label: 'Last month',
      range: { start: shiftMonth(thisMonth.start, -1), end: toIsoDate(lastMonthEnd) },
    },
    { label: 'Last 30 days', range: { start: toIsoDate(thirtyDaysAgo), end: toIsoDate(today) } },
    {
      label: 'This year',
      range: { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` },
    },
  ];
}

/** "Last month", "1 Aug – 3 Sep 2026", "From 1 Aug 2026" — the date chip's text. */
export function dateLabel(filters: TransactionFilters, today: Date = new Date()): string {
  const { start, end } = filters;
  if (!start && !end) return 'Any time';
  const preset = datePresets(today).find((p) => p.range.start === start && p.range.end === end);
  if (preset) return preset.label;
  if (start && end) return formatRange({ start, end });
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end)}`;
}

/** "S$10.00 – S$50.00", "Up to S$50.00", "SGD only" — the amount chip's text. */
export function amountLabel(filters: TransactionFilters): string {
  const { currency } = filters;
  if (!currency) return 'Any amount';
  const min = readAmount(filters.min);
  const max = boundsInverted(filters) ? null : readAmount(filters.max);
  if (min !== null && max !== null) {
    return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (min !== null) return `${formatMoney(min, currency)} or more`;
  if (max !== null) return `Up to ${formatMoney(max, currency)}`;
  return `${currency} only`;
}

/**
 * How many of the person's categories a selection leaves out, the Uncategorised bucket counting
 * as one — what the category chip reports, so a filtered list never looks like an unfiltered one.
 */
export function hiddenCategories(
  selection: CategorySelection,
  categories: readonly Category[]
): number {
  const chosen =
    selection.ids === null
      ? categories.length
      : categories.filter((c) => selection.ids?.includes(c.id)).length;
  return categories.length - chosen + (selection.uncategorized ? 0 : 1);
}

/** "All categories", or "Categories · 2 hidden" — the category chip's text, as on the web. */
export function categoryLabel(
  selection: CategorySelection,
  categories: readonly Category[]
): string {
  const hidden = hiddenCategories(selection, categories);
  return hidden > 0 ? `Categories · ${hidden} hidden` : 'All categories';
}

/**
 * The filters in words, for the export's About sheet — the same words the chips show, so the
 * file describes itself the way the screen did. The web's twin, line for line.
 */
export function describeFilters(
  filters: TransactionFilters,
  categories: readonly Category[]
): string[] {
  const lines: string[] = [];
  const q = filters.q.trim();
  if (q) lines.push(`Search: ${q}`);
  if (filters.start || filters.end) lines.push(`Dates: ${dateLabel(filters)}`);
  const { ids, uncategorized } = filters.categories;
  if (ids !== null || !uncategorized) {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    const chosen =
      ids === null ? ['Every category'] : ids.map((id) => names.get(id) ?? 'Deleted category');
    if (ids !== null && uncategorized) chosen.push(UNCATEGORISED);
    lines.push(`Categories: ${chosen.join(', ') || 'none'}`);
  }
  if (filters.currency) lines.push(`Amount: ${amountLabel(filters)}`);
  return lines;
}

/**
 * Add two non-negative decimal strings exactly, digit by digit — a year of VND in thousandths is
 * past where a double stays exact, and a list's total must agree with its rows.
 */
function addDecimal(a: string, b: string): string {
  const [aWhole, aFrac = ''] = a.split('.');
  const [bWhole, bFrac = ''] = b.split('.');
  const places = Math.max(aFrac.length, bFrac.length);
  const x = aWhole + aFrac.padEnd(places, '0');
  const y = bWhole + bFrac.padEnd(places, '0');
  const width = Math.max(x.length, y.length);
  let digits = '';
  let carry = 0;
  for (let i = 1; i <= width; i++) {
    const sum = Number(x[x.length - i] ?? 0) + Number(y[y.length - i] ?? 0) + carry;
    digits = String(sum % 10) + digits;
    carry = sum >= 10 ? 1 : 0;
  }
  if (carry) digits = '1' + digits;
  const whole = digits.slice(0, digits.length - places).replace(/^0+(?=\d)/, '') || '0';
  return places ? `${whole}.${digits.slice(digits.length - places)}` : whole;
}

/**
 * What the shown rows add up to, one total per currency, largest count first. Per currency
 * rather than converted: the phone has no exchange rates, and "S$120 + ₫50,000" is exact where a
 * converted figure would be an estimate dressed as a fact.
 */
export function totalsByCurrency(
  expenses: readonly Expense[]
): { currency: string; total: string }[] {
  const totals = new Map<string, { total: string; count: number }>();
  for (const expense of expenses) {
    const was = totals.get(expense.currency) ?? { total: '0', count: 0 };
    totals.set(expense.currency, {
      total: addDecimal(was.total, expense.amount),
      count: was.count + 1,
    });
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([currency, { total }]) => ({ currency, total }));
}
