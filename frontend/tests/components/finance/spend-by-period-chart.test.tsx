/**
 * The spending-over-time bar panel.
 *
 * jsdom gives every element zero size, so recharts' ResponsiveContainer draws
 * no SVG here and there is nothing useful to assert about arcs or bars. What is
 * worth pinning down is everything around them: which state a panel picks, and
 * that the figures beside a chart are the API's own strings rather than anything
 * re-derived from the floats the chart is sized with.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ALL_CATEGORIES, type CategorySelection } from '@/components/finance/category-filter';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import type { Resource } from '@/lib/hooks/use-collection';
import type { PeriodBreakdown } from '@/lib/types/finance';
import { FOOD, RANGE, RENT, noop, resource } from '@/tests/support/finance';

const PERIOD: PeriodBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  granularity: 'week',
  buckets: [
    { starts_on: '2026-08-01', ends_on: '2026-08-02', spent: '20.000' },
    { starts_on: '2026-08-03', ends_on: '2026-08-09', spent: '0.000' },
  ],
};

function renderBars(
  breakdown: Resource<PeriodBreakdown>,
  selection: CategorySelection = ALL_CATEGORIES
) {
  return render(
    <SpendByPeriodChart
      breakdown={breakdown}
      range={RANGE}
      onRangeChange={noop}
      categories={[FOOD, RENT]}
      selection={selection}
      onSelectionChange={noop}
    />
  );
}

describe('SpendByPeriodChart', () => {
  it('treats a range with no spending at all as empty', () => {
    const quiet = { ...PERIOD, buckets: PERIOD.buckets.map((b) => ({ ...b, spent: '0.000' })) };
    renderBars(resource(quiet));

    // Zero bars across the board is a chart with nothing to say, unlike a
    // single quiet week among busy ones — which does get a zero bar.
    expect(screen.getByText(/nothing spent/i)).toBeInTheDocument();
  });

  it('widens the plot past the panel so a long range scrolls instead of cramming', () => {
    const year = {
      ...PERIOD,
      buckets: Array.from({ length: 53 }, (_, week) => ({
        starts_on: '2026-01-01',
        ends_on: '2026-01-07',
        spent: String(week + 1),
      })),
    };
    const { rerender } = renderBars(resource(year));

    // jsdom lays nothing out, so the floor itself is what is assertable: it has
    // to grow with the bars, which is what pushes the panel into scrolling.
    const wide = screen.getByTestId('period-chart-plot').style.minWidth;

    rerender(
      <SpendByPeriodChart
        breakdown={resource(PERIOD)}
        range={RANGE}
        onRangeChange={noop}
        categories={[FOOD, RENT]}
        selection={ALL_CATEGORIES}
        onSelectionChange={noop}
      />
    );
    const narrow = screen.getByTestId('period-chart-plot').style.minWidth;

    expect(parseInt(wide, 10)).toBeGreaterThan(parseInt(narrow, 10));
    // Two buckets must not reserve more room than the panel already has, or a
    // short range would scroll for no reason.
    expect(parseInt(narrow, 10)).toBeLessThan(200);
  });

  it('shows a spinner rather than an empty state while loading', () => {
    renderBars(resource<PeriodBreakdown>(null, { loading: true }));

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/nothing spent/i)).toBeNull();
  });
});
