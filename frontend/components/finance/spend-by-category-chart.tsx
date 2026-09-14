'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  CategoryFilter,
  isEmptySelection,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { Panel, PanelNote } from '@/components/finance/panel';
import { RangeControls, RangeNav } from '@/components/finance/range-control';
import { formatRange, shiftRange, type DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { sumAmounts } from '@/lib/money';
import { NEUTRAL_COLOUR } from '@/lib/tint';
import { formatMoney, type Category, type CategoryBreakdown } from '@/lib/types/finance';

/**
 * Categories listed in full before the rest are gathered into "Others".
 *
 * Four because the legend has to fit beside two pies without scrolling in the
 * common case, and because a list long enough to need scrolling stops being a
 * summary. The gathered row still carries its own totals, so nothing is hidden
 * — only named.
 */
const NAMED_ROWS = 4;

/**
 * A slice, ready for recharts.
 *
 * `value` is the only number here and it exists to size an arc; `spent` carries
 * the API's string alongside it so every figure a person actually reads comes
 * from the server rather than from a float round trip.
 */
interface Slice {
  key: string;
  name: string;
  colour: string;
  value: number;
  spent: string;
  /** Whole percent of this pie's total. Sizing a legend row, not money. */
  share: number;
}

/** One row of the shared legend: the same category in both periods. */
interface Comparison {
  key: string;
  name: string;
  colour: string;
  previousShare: number;
  currentShare: number;
  previousSpent: string;
  currentSpent: string;
}

/** The uncategorized bucket has no id, so it needs a key of its own. */
function sliceKey(categoryId: string | null): string {
  return categoryId ?? 'uncategorised';
}

function toSlices(breakdown: CategoryBreakdown | null): Slice[] {
  const rows = breakdown?.categories ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.spent), 0);
  return rows.map((row) => {
    const value = Number(row.spent);
    return {
      key: sliceKey(row.category_id),
      name: row.name,
      colour: row.colour,
      value,
      spent: row.spent,
      share: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });
}

function SliceTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{slice.name}</p>
      <p className="text-fg-muted">
        {formatMoney(slice.spent, currency)} · {slice.share}%
      </p>
    </div>
  );
}

/** One pie, with what it adds up to underneath. */
function PeriodPie({
  slices,
  currency,
  caption,
}: {
  slices: Slice[];
  currency: string;
  caption: string;
}) {
  const total = sumAmounts(slices.map((slice) => slice.spent));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        {slices.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-fg-subtle">Nothing spent</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                // A solid circle, not a ring: nothing sits in the middle worth
                // cutting a hole for, and slices are easier to compare by area
                // when each runs all the way to the centre.
                innerRadius={0}
                outerRadius="98%"
                label={false}
                stroke="none"
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.key} fill={slice.colour} />
                ))}
              </Pie>
              <Tooltip content={<SliceTooltip currency={currency} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-1 truncate text-center text-sm font-semibold">
        {formatMoney(total, currency)}
      </p>
      <p className="truncate text-center text-[11px] text-fg-muted">{caption}</p>
    </div>
  );
}

/**
 * Line up the two pies' categories so one legend can serve both.
 *
 * A category can be missing from either side — new this period, or nothing
 * spent on it last period — so the rows are the union, with a zero standing in
 * for absent. Dropping either side's extras would hide exactly the changes the
 * comparison exists to show.
 */
function compare(previous: Slice[], current: Slice[]): Comparison[] {
  const rows = new Map<string, Comparison>();
  const blank = (slice: Slice): Comparison => ({
    key: slice.key,
    name: slice.name,
    colour: slice.colour,
    previousShare: 0,
    currentShare: 0,
    previousSpent: '0',
    currentSpent: '0',
  });

  for (const slice of previous) {
    const row = rows.get(slice.key) ?? blank(slice);
    rows.set(slice.key, { ...row, previousShare: slice.share, previousSpent: slice.spent });
  }
  for (const slice of current) {
    const row = rows.get(slice.key) ?? blank(slice);
    rows.set(slice.key, { ...row, currentShare: slice.share, currentSpent: slice.spent });
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.currentShare - a.currentShare ||
      b.previousShare - a.previousShare ||
      a.name.localeCompare(b.name)
  );
}

/**
 * Keep the biggest few and gather the tail into one row.
 *
 * Only worth doing when the tail is more than a single category: collapsing one
 * row into "Others" hides its name and saves nothing.
 */
function collapse(rows: Comparison[]): Comparison[] {
  if (rows.length <= NAMED_ROWS + 1) return rows;

  const named = rows.slice(0, NAMED_ROWS);
  const rest = rows.slice(NAMED_ROWS);
  return [
    ...named,
    {
      key: 'others',
      name: `Others (${rest.length})`,
      colour: NEUTRAL_COLOUR,
      // Shares are whole percents already rounded per category, so these can
      // land a point off the true total. The money either side is exact, and
      // that is the figure worth trusting.
      previousShare: rest.reduce((sum, row) => sum + row.previousShare, 0),
      currentShare: rest.reduce((sum, row) => sum + row.currentShare, 0),
      previousSpent: sumAmounts(rest.map((row) => row.previousSpent)),
      currentSpent: sumAmounts(rest.map((row) => row.currentSpent)),
    },
  ];
}

interface SpendByCategoryChartProps {
  current: Resource<CategoryBreakdown>;
  previous: Resource<CategoryBreakdown>;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  categories: Category[];
  selection: CategorySelection;
  onSelectionChange: (selection: CategorySelection) => void;
}

/**
 * Where the money went, this period against the one before it.
 *
 * Two pies rather than one because a single share is hard to judge — 24% on
 * food is only high or low next to what it was. They share a legend, set beside
 * them rather than beneath so the circles get the panel's full height: one row
 * per category carrying both figures, so the comparison is a line of text
 * rather than an eye flicking between two circles.
 */
export function SpendByCategoryChart({
  current,
  previous,
  range,
  onRangeChange,
  categories,
  selection,
  onSelectionChange,
}: SpendByCategoryChartProps) {
  const currency = current.data?.currency ?? 'USD';
  const error = current.error ?? previous.error;
  const loading = current.loading || previous.loading;

  const currentSlices = toSlices(current.data);
  const previousSlices = toSlices(previous.data);
  const rows = collapse(compare(previousSlices, currentSlices));

  return (
    <Panel
      title="Spending categories"
      error={error}
      className="h-[26rem]"
      action={<RangeNav range={range} onChange={onRangeChange} />}
      header={
        <RangeControls range={range} onChange={onRangeChange} idPrefix="category">
          <CategoryFilter
            categories={categories}
            selection={selection}
            onChange={onSelectionChange}
            idPrefix="category-filter"
          />
        </RangeControls>
      }
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : isEmptySelection(selection) ? (
        <PanelNote>No categories selected.</PanelNote>
      ) : rows.length === 0 ? (
        <PanelNote>Nothing spent in either period yet.</PanelNote>
      ) : (
        <div className="flex h-full gap-3 p-3">
          <PeriodPie
            slices={previousSlices}
            currency={currency}
            caption={formatRange(shiftRange(range, -1))}
          />
          <PeriodPie slices={currentSlices} currency={currency} caption={formatRange(range)} />

          <ul className="min-w-0 flex-[1.1] space-y-2 overflow-y-auto text-xs">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.colour }}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">{row.previousShare}%</span>
                  <span aria-hidden className="shrink-0 text-fg-subtle">
                    →
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{row.currentShare}%</span>
                </div>
                <p className="truncate pl-4 text-[11px] tabular-nums text-fg-muted">
                  {formatMoney(row.previousSpent, currency)} →{' '}
                  {formatMoney(row.currentSpent, currency)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
