'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Panel, PanelNote } from '@/components/finance/panel';
import { formatSpan } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type WeeklyBreakdown } from '@/lib/types/finance';

interface Week {
  /** "3–9 Aug" — the days this bar actually covers, which may be under seven. */
  label: string;
  value: number;
  spent: string;
}

function WeekTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Week }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{week.label}</p>
      <p className="text-gray-600">{formatMoney(week.spent, currency)}</p>
    </div>
  );
}

interface SpendByWeekChartProps {
  breakdown: Resource<WeeklyBreakdown>;
  period: string;
}

/**
 * Spending week by week across one month.
 *
 * The first and last bar usually cover fewer than seven days, because the month
 * rarely starts on a Monday. That is why each is labelled with its own span
 * rather than "Week 1" — a two-day bar should look short for a reason a person
 * can see.
 */
export function SpendByWeekChart({ breakdown, period }: SpendByWeekChartProps) {
  const { data, loading, error } = breakdown;

  const weeks: Week[] = (data?.weeks ?? []).map((week) => ({
    label: formatSpan(week.starts_on, week.ends_on),
    value: Number(week.spent),
    spent: week.spent,
  }));
  const anySpend = weeks.some((week) => week.value > 0);

  return (
    <Panel title={`Spending by week · ${period}`} error={error} className="h-80">
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : !anySpend ? (
        <PanelNote>Nothing spent in this period yet.</PanelNote>
      ) : (
        <div className="h-full p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                content={<WeekTooltip currency={data?.currency ?? 'USD'} />}
              />
              <Bar
                dataKey="value"
                fill="#111827"
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
