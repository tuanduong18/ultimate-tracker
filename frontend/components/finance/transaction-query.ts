import { ALL_CATEGORIES, type CategorySelection } from '@/components/finance/category-filter';
import {
  formatDate,
  formatRange,
  monthRange,
  shiftMonth,
  toIsoDate,
  type DateRange,
} from '@/lib/dates';
import { formatMoney, type Category, type Expense } from '@/lib/types/finance';

/**
 * What the Transactions tab is narrowed to, and how a row is tested against it.
 *
 * Filtering happens here, in the browser, over every expense: a person logs a
 * few a day, so even decades of them is a list the browser holds easily, and
 * a filter that runs locally answers on the keystroke instead of after a
 * round trip. The export sends the ids this produced, so the file cannot
 * disagree with the screen.
 *
 * Kept as the strings the inputs hold, not parsed values: an amount someone is
 * halfway through typing ("12.") has to survive a re-render, and the URL holds
 * strings anyway.
 */
export interface TransactionFilters {
  /** Free text, found like Ctrl+F in anything a row shows — see rowText. */
  q: string;
  /** YYYY-MM-DD, or '' for open-ended on that side. */
  start: string;
  end: string;
  categories: CategorySelection;
  /** '' for any currency. Set whenever min or max is — see AmountFilter. */
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
 * A typed bound as a plain decimal, or null when it is not a number yet.
 * Forgiving on purpose: "1,200", " 12.5 " and "$40" all mean something.
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
 * The text a row shows, one entry per field, lower-cased for matching.
 *
 * Search works like Ctrl+F on the list: whatever someone can read on a row,
 * they can find it by. That includes "Uncategorised", which is a label the
 * row draws rather than data, and the date and amount as they are written on
 * screen. Fields are kept apart so a search cannot match across the gap
 * between two of them, which Ctrl+F would not do either.
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
  // The app spells it the British way; someone searching the American way
  // is looking for the same rows.
  if (category === UNCATEGORISED) fields.push('Uncategorized');
  return fields.map((field) => field.toLocaleLowerCase());
}

/** What the row says when it has no category — the same word ExpenseSection draws. */
const UNCATEGORISED = 'Uncategorised';

/**
 * Build the test for one set of filters, to run over every row.
 *
 * Search is one case-insensitive phrase, as typed (ends trimmed), found
 * anywhere inside a field — see rowText.
 *
 * Amounts are compared as recorded, in the filter's currency — never
 * converted, which would make which rows match drift with the exchange rate.
 * Comparing through Number is safe here: it decides order, it sums nothing.
 */
export function matcher(
  filters: TransactionFilters,
  categories: Category[]
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

/** True when anything narrows the list — what decides whether "Clear filters" shows. */
export function isFiltered(filters: TransactionFilters): boolean {
  return toParams(filters).size > 0;
}

/**
 * The filters as a query string, so a filtered view survives a reload and can
 * be bookmarked. Only what actually narrows the list is written.
 */
export function toParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set('q', q);
  if (filters.start) params.set('from', filters.start);
  if (filters.end) params.set('to', filters.end);
  for (const id of filters.categories.ids ?? []) params.append('category', id);
  // An empty pick ("Clear") has no ids to write, so it needs saying outright.
  if (filters.categories.ids?.length === 0) params.set('category', 'none');
  if (!filters.categories.uncategorized) params.set('uncategorised', 'hide');
  if (filters.currency) {
    params.set('currency', filters.currency);
    const min = readAmount(filters.min);
    const max = readAmount(filters.max);
    if (min !== null) params.set('min', min);
    if (max !== null) params.set('max', max);
  }
  return params;
}

/** The inverse of `toParams`, for a page opened from a link or reloaded. */
export function fromParams(params: URLSearchParams): TransactionFilters {
  const ids = params.getAll('category');
  return {
    q: params.get('q') ?? '',
    start: params.get('from') ?? '',
    end: params.get('to') ?? '',
    categories: {
      ids: ids.length === 0 ? null : ids.filter((id) => id !== 'none'),
      uncategorized: params.get('uncategorised') !== 'hide',
    },
    currency: params.get('currency') ?? '',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
  };
}

/**
 * The date presets. "Last 30 days" rather than "last week": a week is what
 * the dashboard chart already answers, and the question people bring to a
 * transaction list is usually "around when did I pay that".
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

/** "Last month", "1 Aug – 3 Sep 2026", "From 1 Aug 2026" — the date pill's text. */
export function dateLabel(filters: TransactionFilters, today: Date = new Date()): string {
  const { start, end } = filters;
  if (!start && !end) return 'Any time';
  const preset = datePresets(today).find((p) => p.range.start === start && p.range.end === end);
  if (preset) return preset.label;
  if (start && end) return formatRange({ start, end });
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end)}`;
}

/** "S$10.00 – S$50.00", "Up to S$50.00", "SGD only" — the amount pill's text. */
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
 * The filters in words, for the export's About sheet — the same words the
 * pills show, so the file describes itself the way the screen did.
 */
export function describeFilters(filters: TransactionFilters, categories: Category[]): string[] {
  const lines: string[] = [];
  const q = filters.q.trim();
  if (q) lines.push(`Search: ${q}`);
  if (filters.start || filters.end) lines.push(`Dates: ${dateLabel(filters)}`);
  const { ids, uncategorized } = filters.categories;
  if (ids !== null || !uncategorized) {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    const chosen =
      ids === null ? ['Every category'] : ids.map((id) => names.get(id) ?? 'Deleted category');
    if (ids !== null && uncategorized) chosen.push('Uncategorised');
    lines.push(`Categories: ${chosen.join(', ') || 'none'}`);
  }
  if (filters.currency) lines.push(`Amount: ${amountLabel(filters)}`);
  return lines;
}

/**
 * Add two non-negative decimal strings exactly.
 *
 * The API sends money as strings so nothing passes through a float; summing
 * them as Numbers would undo that, and a year of VND in thousandths is past
 * where a double stays exact. Digit by digit is plenty for a list's total.
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
 * What the shown rows add up to, one total per currency, largest count first.
 *
 * Per currency rather than converted: the browser has no exchange rates, and
 * "S$120 + ₫50,000" is exact where a converted figure would be an estimate
 * dressed as a fact. The export's converted column is there for the other need.
 */
export function totalsByCurrency(expenses: Expense[]): { currency: string; total: string }[] {
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
