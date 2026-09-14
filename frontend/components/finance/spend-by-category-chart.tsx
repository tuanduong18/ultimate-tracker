'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Panel, PanelNote } from '@/components/finance/panel';
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
}

function SliceTooltip({
  active,
  payload,
  currency,
  total,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  currency: string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;
  return (
    <div className="rounded border border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{slice.name}</p>
      <p className="text-fg-muted">
        {formatMoney(slice.spent, currency)} · {share}%
      </p>
    </div>
  );
}

interface SpendByCategoryChartProps {
  breakdown: Resource<CategoryBreakdown>;
  /** "September 2026" — the window the slices cover. */
  period: string;
}

export function SpendByCategoryChart({ breakdown, period }: SpendByCategoryChartProps) {
  const { data, loading, error } = breakdown;

  const slices: Slice[] = (data?.categories ?? []).map((category) => ({
    name: category.name,
    colour: category.colour,
    value: Number(category.spent),
    spent: category.spent,
  }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Panel title={`Spending by category · ${period}`} error={error} className="h-80">
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : slices.length === 0 ? (
        <PanelNote>Nothing spent in this period yet.</PanelNote>
      ) : (
        <div className="flex h-full items-center gap-4 p-4">
          <div className="h-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  // A solid circle, not a ring: nothing sits in the middle
                  // worth cutting a hole for, and the slices are easier to
                  // compare by area when each runs all the way to the centre.
                  innerRadius={0}
                  outerRadius="90%"
                  // Off, because the slices that need a label are the thin ones
                  // and those are exactly where the label has nowhere to go.
                  // The legend beside the chart carries the same information.
                  label={false}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.colour} />
                  ))}
                </Pie>
                <Tooltip
                  content={<SliceTooltip currency={data?.currency ?? 'USD'} total={total} />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="max-h-full w-40 shrink-0 space-y-1.5 overflow-y-auto text-xs">
            {slices.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.colour }}
                />
                <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                <span className="shrink-0 text-fg-muted">
                  {formatMoney(slice.spent, data?.currency ?? 'USD')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
