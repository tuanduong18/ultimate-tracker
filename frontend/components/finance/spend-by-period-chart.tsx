'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Panel } from '@/components/finance/panel';
import { PanelNote } from '@/components/finance/panel';
import { RangeControl } from '@/components/finance/range-control';
import { formatSpan, type DateRange } from '@/lib/dates';
import { useThemeColours } from '@/lib/hooks/use-theme-colours';
import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type PeriodBreakdown } from '@/lib/types/finance';

/** Unique per chart instance, since two charts on one page share a document. */
const GRADIENT_ID = 'spend-bar-gradient';

interface Bucket {
  /** "3–9 Aug", or just "4 Aug" for a day bucket. */
  label: string;
  /** Short form for the axis, where a full span will not fit. */
  tick: string;
  value: number;
  spent: string;
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cap?: string;
}

/**
 * A bar that fades from solid at the top to nearly clear at the bottom, with a
 * solid cap along its top edge.
 *
 * The cap is the point: a gradient bar has no crisp top, so the eye cannot tell
 * two similar bars apart. The cap gives the value a hard line to sit on while
 * the gradient keeps the chart light.
 */
function GradientBar({ x = 0, y = 0, width = 0, height = 0, cap }: BarShapeProps) {
  if (height <= 0 || width <= 0) return null;
  const capHeight = Math.min(3, height);

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={5} fill={`url(#${GRADIENT_ID})`} />
      <rect x={x} y={y} width={width} height={capHeight} rx={1.5} fill={cap} />
    </g>
  );
}

function BucketTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Bucket }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{bucket.label}</p>
      <p className="text-fg-muted">{formatMoney(bucket.spent, currency)}</p>
    </div>
  );
}

interface SpendByPeriodChartProps {
  breakdown: Resource<PeriodBreakdown>;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

/**
 * Spending over time, one bar per day or per week.
 *
 * Buckets are labelled with the days they actually cover rather than "Week 1",
 * because a week bucket clipped by the ends of the range is shorter than the
 * rest and should look short for a visible reason.
 */
export function SpendByPeriodChart({ breakdown, range, onRangeChange }: SpendByPeriodChartProps) {
  const { data, loading, error } = breakdown;
  // recharts styles its SVG from props, so these cannot be Tailwind classes.
  const colour = useThemeColours();
  const currency = data?.currency ?? 'USD';

  const buckets: Bucket[] = (data?.buckets ?? []).map((bucket) => {
    const label = formatSpan(bucket.starts_on, bucket.ends_on);
    return {
      label,
      // Day buckets are already short; week buckets get their start day only,
      // which is enough to order them once the range is named above the chart.
      tick: data?.granularity === 'day' ? label : label.split('–')[0].trim(),
      value: Number(bucket.spent),
      spent: bucket.spent,
    };
  });
  const anySpend = buckets.some((bucket) => bucket.value > 0);

  return (
    <Panel
      title="Spending amount"
      error={error}
      className="h-[26rem]"
      header={<RangeControl range={range} onChange={onRangeChange} idPrefix="period" />}
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : !anySpend ? (
        <PanelNote>Nothing spent in this period yet.</PanelNote>
      ) : (
        <div className="h-full p-4 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colour.primary} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={colour.primary} stopOpacity={0.12} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="4 4" stroke={colour.border} vertical={false} />
              <XAxis
                dataKey="tick"
                tick={{ fontSize: 11, fill: colour['fg-muted'] }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: colour['fg-muted'] }}
                tickLine={false}
                axisLine={false}
                width={72}
                // The currency belongs on the axis: every figure in this app is
                // converted into the display currency, and a bare number invites
                // reading it as whatever the last expense was entered in.
                tickFormatter={(value: number) =>
                  `${new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)} ${currency}`
                }
              />
              <Tooltip
                cursor={{ fill: colour['surface-muted'] }}
                content={<BucketTooltip currency={currency} />}
              />
              <Bar
                dataKey="value"
                maxBarSize={44}
                isAnimationActive={false}
                shape={<GradientBar cap={colour.primary} />}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
