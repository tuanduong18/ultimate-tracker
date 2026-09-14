'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Panel, PanelNote } from '@/components/finance/panel';
import { RangeControl } from '@/components/finance/range-control';
import type { DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type CategoryBreakdown } from '@/lib/types/finance';

/**
 * A slice, ready for recharts.
 *
 * `value` is the only number here and it exists to size an arc; `spent` carries
 * the API's string alongside it so every figure a person actually reads comes
 * from the server rather than from a float round trip.
 */
interface Slice {
  name: string;
  colour: string;
  value: number;
  spent: string;
  /** Whole percent of the range's total. Sizing a legend row, not money. */
  share: number;
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

interface SpendByCategoryChartProps {
  breakdown: Resource<CategoryBreakdown>;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export function SpendByCategoryChart({
  breakdown,
  range,
  onRangeChange,
}: SpendByCategoryChartProps) {
  const { data, loading, error } = breakdown;
  const currency = data?.currency ?? 'USD';

  const rows = data?.categories ?? [];
  const total = rows.reduce((sum, category) => sum + Number(category.spent), 0);
  const slices: Slice[] = rows.map((category) => {
    const value = Number(category.spent);
    return {
      name: category.name,
      colour: category.colour,
      value,
      spent: category.spent,
      share: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });

  return (
    <Panel
      title="Spending categories"
      error={error}
      className="h-[26rem]"
      header={<RangeControl range={range} onChange={onRangeChange} idPrefix="category" />}
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : slices.length === 0 ? (
        <PanelNote>Nothing spent in this period yet.</PanelNote>
      ) : (
        <div className="flex h-full items-center gap-4 p-4 pt-2">
          <div className="h-full min-w-0 flex-1">
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
                  // Off, because the slices that need a label are the thin ones
                  // and those are exactly where a label has nowhere to go. The
                  // legend beside the chart carries the same information.
                  label={false}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.colour} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Share first, then name: the question a pie is asked is "how much of
              the total", and reading down a column of percentages answers it
              without going back to the chart. */}
          <ul className="max-h-full w-40 shrink-0 space-y-2 overflow-y-auto text-xs">
            {slices.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.colour }}
                />
                <span className="shrink-0 font-semibold tabular-nums">{slice.share}%</span>
                <span className="min-w-0 flex-1 truncate text-fg-muted">{slice.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
