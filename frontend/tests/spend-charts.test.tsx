/**
 * The two chart panels.
 *
 * jsdom gives every element zero size, so recharts' ResponsiveContainer draws
 * no SVG here and there is nothing useful to assert about arcs or bars. What is
 * worth pinning down is everything around them: which state the panel picks,
 * and that the figures beside the chart are the API's own strings rather than
 * anything re-derived from the floats the chart is sized with.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByWeekChart } from '@/components/finance/spend-by-week-chart';
import type { Resource } from '@/lib/hooks/use-collection';
import type { CategoryBreakdown, WeeklyBreakdown } from '@/lib/types/finance';

function resource<T>(data: T | null, rest: Partial<Resource<T>> = {}): Resource<T> {
  return {
    data,
    loading: false,
    error: null,
    reload: vi.fn(),
    setError: vi.fn(),
    ...rest,
  };
}

const BREAKDOWN: CategoryBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '120.000' },
    { category_id: null, name: 'Uncategorised', colour: '#e5e7eb', spent: '30.000' },
  ],
};

const WEEKLY: WeeklyBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  weeks: [
    { starts_on: '2026-08-01', ends_on: '2026-08-02', spent: '20.000' },
    { starts_on: '2026-08-03', ends_on: '2026-08-09', spent: '0.000' },
  ],
};

describe('SpendByCategoryChart', () => {
  it('lists each slice beside the chart with the amount the API sent', () => {
    render(<SpendByCategoryChart breakdown={resource(BREAKDOWN)} period="August 2026" />);

    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
  });

  it('keeps spend whose category was deleted visible as its own slice', () => {
    render(<SpendByCategoryChart breakdown={resource(BREAKDOWN)} period="August 2026" />);

    // The alternative is quietly dropping it, which makes the slices stop
    // adding up to the Spent tile above them.
    expect(screen.getByText('Uncategorised')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('says nothing was spent rather than drawing an empty pie', () => {
    render(
      <SpendByCategoryChart
        breakdown={resource({ ...BREAKDOWN, categories: [] })}
        period="August 2026"
      />
    );

    expect(screen.getByText(/nothing spent/i)).toBeInTheDocument();
  });

  it('surfaces a failed fetch instead of an empty state that looks like no spending', () => {
    render(
      <SpendByCategoryChart
        breakdown={resource<CategoryBreakdown>(null, { error: 'Exchange rates are unavailable.' })}
        period="August 2026"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/exchange rates/i);
  });
});

describe('SpendByWeekChart', () => {
  it('treats a month with no spending at all as empty', () => {
    const quiet = { ...WEEKLY, weeks: WEEKLY.weeks.map((w) => ({ ...w, spent: '0.000' })) };
    render(<SpendByWeekChart breakdown={resource(quiet)} period="August 2026" />);

    // Zero bars across the board is a chart with nothing to say, unlike a
    // single quiet week among busy ones — which does get a zero bar.
    expect(screen.getByText(/nothing spent/i)).toBeInTheDocument();
  });

  it('names the period it covers', () => {
    render(<SpendByWeekChart breakdown={resource(WEEKLY)} period="August 2026" />);

    expect(screen.getByText(/August 2026/)).toBeInTheDocument();
  });

  it('shows a spinner rather than an empty state while loading', () => {
    render(
      <SpendByWeekChart
        breakdown={resource<WeeklyBreakdown>(null, { loading: true })}
        period="August 2026"
      />
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/nothing spent/i)).toBeNull();
  });
});
