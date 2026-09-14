/**
 * The two chart panels and the range control they share.
 *
 * jsdom gives every element zero size, so recharts' ResponsiveContainer draws
 * no SVG here and there is nothing useful to assert about arcs or bars. What is
 * worth pinning down is everything around them: which state the panel picks,
 * that the figures beside the chart are the API's own strings rather than
 * anything re-derived from the floats the chart is sized with, and that the
 * range control hands back the windows it claims to.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { granularityFor, RangeControl } from '@/components/finance/range-control';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import type { DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import type { CategoryBreakdown, PeriodBreakdown } from '@/lib/types/finance';

function resource<T>(data: T | null, rest: Partial<Resource<T>> = {}): Resource<T> {
  return { data, loading: false, error: null, reload: vi.fn(), setError: vi.fn(), ...rest };
}

const RANGE: DateRange = { start: '2026-08-01', end: '2026-08-31' };
const noop = () => {};

const BREAKDOWN: CategoryBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '75.000' },
    { category_id: null, name: 'Uncategorised', colour: '#e5e7eb', spent: '25.000' },
  ],
};

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

describe('SpendByCategoryChart', () => {
  it('leads each legend row with its share of the total', () => {
    render(
      <SpendByCategoryChart breakdown={resource(BREAKDOWN)} range={RANGE} onRangeChange={noop} />
    );

    // 75 and 25 of 100.
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('keeps spend whose category was deleted visible as its own slice', () => {
    render(
      <SpendByCategoryChart breakdown={resource(BREAKDOWN)} range={RANGE} onRangeChange={noop} />
    );

    // The alternative is quietly dropping it, which makes the slices stop
    // adding up to what the same range reports as spent.
    expect(screen.getByText('Uncategorised')).toBeInTheDocument();
  });

  it('says nothing was spent rather than drawing an empty pie', () => {
    render(
      <SpendByCategoryChart
        breakdown={resource({ ...BREAKDOWN, categories: [] })}
        range={RANGE}
        onRangeChange={noop}
      />
    );

    expect(screen.getByText(/nothing spent/i)).toBeInTheDocument();
  });

  it('surfaces a failed fetch instead of an empty state that looks like no spending', () => {
    render(
      <SpendByCategoryChart
        breakdown={resource<CategoryBreakdown>(null, { error: 'Exchange rates are unavailable.' })}
        range={RANGE}
        onRangeChange={noop}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/exchange rates/i);
  });
});

describe('SpendByPeriodChart', () => {
  it('treats a range with no spending at all as empty', () => {
    const quiet = { ...PERIOD, buckets: PERIOD.buckets.map((b) => ({ ...b, spent: '0.000' })) };
    render(<SpendByPeriodChart breakdown={resource(quiet)} range={RANGE} onRangeChange={noop} />);

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
    const { rerender } = render(
      <SpendByPeriodChart breakdown={resource(year)} range={RANGE} onRangeChange={noop} />
    );

    // jsdom lays nothing out, so the floor itself is what is assertable: it has
    // to grow with the bars, which is what pushes the panel into scrolling.
    const wide = screen.getByTestId('period-chart-plot').style.minWidth;

    rerender(
      <SpendByPeriodChart breakdown={resource(PERIOD)} range={RANGE} onRangeChange={noop} />
    );
    const narrow = screen.getByTestId('period-chart-plot').style.minWidth;

    expect(parseInt(wide, 10)).toBeGreaterThan(parseInt(narrow, 10));
    // Two buckets must not reserve more room than the panel already has, or a
    // short range would scroll for no reason.
    expect(parseInt(narrow, 10)).toBeLessThan(200);
  });

  it('shows a spinner rather than an empty state while loading', () => {
    render(
      <SpendByPeriodChart
        breakdown={resource<PeriodBreakdown>(null, { loading: true })}
        range={RANGE}
        onRangeChange={noop}
      />
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/nothing spent/i)).toBeNull();
  });
});

describe('RangeControl', () => {
  function renderControl(range: DateRange = RANGE) {
    const onChange = vi.fn();
    render(<RangeControl range={range} onChange={onChange} idPrefix="test" />);
    return onChange;
  }

  it('steps back by the range’s own length', () => {
    const onChange = renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    // August is 31 days, so the previous window is the 31 days before it —
    // which is July 1st to 31st, not "last month" by name.
    expect(onChange).toHaveBeenCalledWith({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('steps forward by the same length, including for a hand-picked range', () => {
    const onChange = renderControl({ start: '2026-08-10', end: '2026-08-12' });

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-13', end: '2026-08-15' });
  });

  it('lets either end of the range be typed directly', () => {
    const onChange = renderControl();

    fireEvent.change(screen.getByLabelText('Range start'), { target: { value: '2026-08-15' } });

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-15', end: '2026-08-31' });
  });

  it('marks the preset that matches the current range', () => {
    // The range here is a whole month, but not necessarily *this* month, so
    // neither preset should claim it.
    renderControl({ start: '2020-01-01', end: '2020-01-31' });

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('granularityFor', () => {
  it('uses day bars for a week and a month', () => {
    expect(granularityFor({ start: '2026-08-03', end: '2026-08-09' })).toBe('day');
    expect(granularityFor({ start: '2026-08-01', end: '2026-08-31' })).toBe('day');
  });

  it('switches to week bars once daily ones would be unreadable', () => {
    // A quarter of daily bars is ninety of them, each about a pixel wide.
    expect(granularityFor({ start: '2026-07-01', end: '2026-09-30' })).toBe('week');
  });
});
