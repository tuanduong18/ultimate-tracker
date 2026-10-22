'use client';

import { Filter, PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  CategoryFilter,
  isEmptySelection,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { Panel, PanelEmpty, PanelNote } from '@/components/finance/panel';
import { RangeControls, RangeNav } from '@/components/finance/range-control';
import { formatRange, shiftRange, type DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { useThemeColours } from '@/lib/hooks/use-theme-colours';
import { sumAmounts } from '@/lib/money';
import { NEUTRAL_COLOUR } from '@/lib/tint';
import { formatMoney, type Category, type CategoryBreakdown } from '@/lib/types/finance';

/**
 * Categories named in full before the rest are gathered into "Others".
 *
 * Past five slices a ring stops being readable — the small ones become slivers
 * nobody can see or label. Four named plus Others keeps it at five.
 */
const NAMED_ROWS = 4;

/**
 * The grey for spend with no category. The API sends a near-white for it,
 * which on a dark surface glows like the most important slice; having no
 * category should look like it, not like a highlight.
 */
const UNCATEGORISED_COLOUR = NEUTRAL_COLOUR;

/** A lighter grey for "Others", so it is not mistaken for Uncategorised. */
const OTHERS_COLOUR = '#cbd5e1';

/** One category in both periods. Strings for every figure a person reads. */
interface Row {
  key: string;
  name: string;
  colour: string;
  previousSpent: string;
  currentSpent: string;
}

/**
 * Line up both periods' categories, rank them, and gather the tail.
 *
 * The union, with zero standing in for absent: a category new this period, or
 * gone since last, is exactly the change the comparison exists to show. Both
 * rings are drawn from these same rows, so a category has one colour and one
 * name in both — and "Others" stands for the same categories in each.
 */
function toRows(previous: CategoryBreakdown | null, current: CategoryBreakdown | null): Row[] {
  const rows = new Map<string, Row>();
  const add = (breakdown: CategoryBreakdown | null, side: 'previousSpent' | 'currentSpent') => {
    for (const entry of breakdown?.categories ?? []) {
      const key = entry.category_id ?? 'uncategorised';
      const existing = rows.get(key) ?? {
        key,
        name: entry.name,
        colour: entry.category_id === null ? UNCATEGORISED_COLOUR : entry.colour,
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

  // Gather only when the tail is more than one category: folding a single row
  // into "Others" hides its name and saves nothing.
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

/** Whole percent of `total`; shares are about one period, so each ring has its own. */
function share(spent: string, total: string): number {
  const all = Number(total);
  return all > 0 ? Math.round((Number(spent) / all) * 100) : 0;
}

/** A slice, ready for recharts: `value` sizes the arc, `spent` is what is read. */
interface Slice {
  key: string;
  name: string;
  colour: string;
  value: number;
  spent: string;
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
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-xs">
      <p className="font-medium">{slice.name}</p>
      <p className="text-fg-muted tabular-nums">
        {formatMoney(slice.spent, currency)} · {slice.share}%
      </p>
    </div>
  );
}

/**
 * One period's ring, with its total in the hole and its window underneath.
 *
 * A period with nothing spent still gets a ring — an empty track — so the pair
 * keeps its shape and "nothing" reads as a value rather than a gap.
 */
function Ring({
  rows,
  side,
  currency,
  caption,
  className,
}: {
  rows: Row[];
  side: 'previousSpent' | 'currentSpent';
  currency: string;
  caption: string;
  className: string;
}) {
  const theme = useThemeColours();
  const total = sumAmounts(rows.map((row) => row[side]));
  const slices: Slice[] = rows
    .filter((row) => Number(row[side]) > 0)
    .map((row) => ({
      key: row.key,
      name: row.name,
      colour: row.colour,
      value: Number(row[side]),
      spent: row[side],
      share: share(row[side], total),
    }));

  return (
    <figure className={`flex-col items-center gap-2 ${className}`}>
      <div className="relative aspect-square w-full">
        {slices.length === 0 ? (
          <div aria-hidden className="absolute inset-0 rounded-full border-[12px] border-fg/10" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="64%"
                outerRadius="100%"
                // A 2px gap in the surface colour between slices, so two similar
                // category colours still read as two slices.
                stroke={theme.surface}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-semibold tracking-tight tabular-nums">
            {formatMoney(total, currency)}
          </span>
          <span className="text-[11px] text-fg-muted">
            {slices.length === 0 ? 'nothing yet' : 'spent'}
          </span>
        </div>
      </div>
      <figcaption className="text-center text-xs text-fg-muted">{caption}</figcaption>
    </figure>
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
 * Where the money went — the share each category took — and how that mix
 * moved since the period before.
 *
 * Rings, because the question is part of a whole: budgets already hold
 * spending against a plan, so this panel is about proportions. Two rings when
 * the panel is wide enough — last period on the left, this one on the right —
 * and one ring, this period's, when it is not. The decision is the panel's
 * own width (a container query), not the screen's: the panel is half-width
 * beside the other chart on a large screen and full-width on a medium one.
 *
 * The legend is the same either way and carries the comparison in text — each
 * row's share last period and this, then this period's amount — so the narrow
 * layout loses a picture, not a fact, and nobody has to compare angles across
 * two circles by eye. Every row is named, so the user-chosen category colours
 * never have to be told apart alone.
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
  const rows = toRows(previous.data, current.data);
  const previousTotal = sumAmounts(rows.map((row) => row.previousSpent));
  const currentTotal = sumAmounts(rows.map((row) => row.currentSpent));
  const previousRange = shiftRange(range, -1);

  return (
    <Panel
      title="Spending by category"
      error={error}
      // Grows with its list on a phone; fixed from sm, where it scrolls in place.
      className="sm:h-104"
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
        <PanelEmpty icon={Filter}>No categories selected.</PanelEmpty>
      ) : rows.length === 0 ? (
        <PanelEmpty icon={PieChartIcon}>
          Nothing spent in {formatRange(range)} or the period before.
        </PanelEmpty>
      ) : (
        // The container the ring count is decided by: two rings from 38rem of
        // panel width (2 × 9rem rings + a 15rem legend + gaps), one below.
        <div className="@container h-full">
          <div className="flex flex-col items-center gap-5 p-4 @min-[38rem]:h-full @min-[38rem]:flex-row">
            <div className="flex shrink-0 gap-4">
              <Ring
                rows={rows}
                side="previousSpent"
                currency={currency}
                caption={formatRange(previousRange)}
                className="hidden w-36 @min-[38rem]:flex"
              />
              <Ring
                rows={rows}
                side="currentSpent"
                currency={currency}
                caption={formatRange(range)}
                className="flex w-44 @min-[38rem]:w-36"
              />
            </div>

            <div className="w-full min-w-0 @min-[38rem]:flex-1 @min-[38rem]:self-stretch @min-[38rem]:overflow-y-auto">
              {/* Column heads, so "24% → 40%" says which share is which. */}
              <p className="mb-2 flex items-center gap-2.5 text-[11px] text-fg-muted">
                <span className="w-2.5 shrink-0" />
                <span className="flex-1">Category</span>
                <span className="shrink-0">Share, last → this</span>
                <span className="min-w-20 shrink-0 text-right">This period</span>
              </p>
              <ul className="space-y-2.5">
                {rows.map((row) => {
                  const before = share(row.previousSpent, previousTotal);
                  const now = share(row.currentSpent, currentTotal);
                  return (
                    <li key={row.key} className="flex items-center gap-2.5 text-sm">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.colour }}
                      />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="sr-only">
                          {before}% of last period, {now}% of this period
                        </span>
                        <span aria-hidden>
                          <span className="text-fg-muted">{before}%</span>
                          <span className="px-1 text-fg-subtle">→</span>
                          <span className="font-semibold">{now}%</span>
                        </span>
                      </span>
                      <span className="min-w-20 shrink-0 text-right text-fg-muted tabular-nums">
                        {formatMoney(row.currentSpent, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
