'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  CategoryFilter,
  isEmptySelection,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { Panel, PanelNote } from '@/components/finance/panel';
import { RangeControl } from '@/components/finance/range-control';
import { formatRange, shiftRange, type DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type Category, type CategoryBreakdown } from '@/lib/types/finance';

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

/** One row of the shared legend: the same category in both pies. */
interface Comparison {
  key: string;
  name: string;
  colour: string;
  previous: number;
  current: number;
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

function Pies({
  slices,
  currency,
  caption,
  emptyNote,
}: {
  slices: Slice[];
  currency: string;
  caption: string;
  emptyNote: string;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {slices.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-fg-subtle">{emptyNote}</p>
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
                outerRadius="92%"
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
      <p className="mt-1 truncate text-center text-[11px] text-fg-muted">{caption}</p>
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
  for (const [slices, field] of [
    [previous, 'previous'],
    [current, 'current'],
  ] as const) {
    for (const slice of slices) {
      const row = rows.get(slice.key) ?? {
        key: slice.key,
        name: slice.name,
        colour: slice.colour,
        previous: 0,
        current: 0,
      };
      row[field] = slice.share;
      rows.set(slice.key, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name)
  );
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
 * food is only high or low next to what it was. They share a legend, which is
 * what makes the pair readable: one row per category carrying both figures,
 * so the comparison is a line of text rather than an eye flicking between two
 * circles.
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
  const rows = compare(previousSlices, currentSlices);
  const previousRange = shiftRange(range, -1);

  return (
    <Panel
      title="Spending categories"
      error={error}
      className="h-[30rem]"
      action={
        <CategoryFilter
          categories={categories}
          selection={selection}
          onChange={onSelectionChange}
          idPrefix="category-filter"
        />
      }
      header={<RangeControl range={range} onChange={onRangeChange} idPrefix="category" />}
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : isEmptySelection(selection) ? (
        <PanelNote>No categories selected.</PanelNote>
      ) : rows.length === 0 ? (
        <PanelNote>Nothing spent in either period yet.</PanelNote>
      ) : (
        <div className="flex h-full flex-col p-4 pt-2">
          <div className="grid min-h-0 flex-[3] grid-cols-2 gap-3">
            <Pies
              slices={previousSlices}
              currency={currency}
              caption={formatRange(previousRange)}
              emptyNote="Nothing spent"
            />
            <Pies
              slices={currentSlices}
              currency={currency}
              caption={formatRange(range)}
              emptyNote="Nothing spent"
            />
          </div>

          {/* Share first, then name: the question a pie is asked is "how much of
              the total", and reading down a column of percentages answers it
              without going back to the chart. */}
          <ul className="mt-3 min-h-0 flex-[2] space-y-1.5 overflow-y-auto text-xs">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.colour }}
                />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-fg-muted">{row.previous}%</span>
                <span aria-hidden className="shrink-0 text-fg-subtle">
                  →
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{row.current}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
