/**
 * The category pie panel: this period against the one before.
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
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import type { Resource } from '@/lib/hooks/use-collection';
import type { CategoryBreakdown } from '@/lib/types/finance';
import { FOOD, RANGE, RENT, noop, resource } from '@/tests/support/finance';

const CURRENT: CategoryBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '75.000' },
    { category_id: null, name: 'Uncategorised', colour: '#e5e7eb', spent: '25.000' },
  ],
};

const PREVIOUS: CategoryBreakdown = {
  ...CURRENT,
  starts_on: '2026-07-01',
  ends_on: '2026-07-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '40.000' },
    { category_id: 'c2', name: 'Rent', colour: '#ef4444', spent: '60.000' },
  ],
};

/** Six categories, which is one more than the legend lists by name. */
const MANY: CategoryBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [
    { category_id: 'c1', name: 'Rent', colour: '#ef4444', spent: '50.00' },
    { category_id: 'c2', name: 'Food', colour: '#22c55e', spent: '20.00' },
    { category_id: 'c3', name: 'Travel', colour: '#3b82f6', spent: '10.00' },
    { category_id: 'c4', name: 'Bills', colour: '#a855f7', spent: '10.00' },
    { category_id: 'c5', name: 'Gym', colour: '#f59e0b', spent: '6.00' },
    { category_id: 'c6', name: 'Books', colour: '#14b8a6', spent: '4.00' },
  ],
};

function renderPie(
  current: Resource<CategoryBreakdown>,
  previous: Resource<CategoryBreakdown> = resource(PREVIOUS),
  selection: CategorySelection = ALL_CATEGORIES
) {
  return render(
    <SpendByCategoryChart
      current={current}
      previous={previous}
      range={RANGE}
      onRangeChange={noop}
      categories={[FOOD, RENT]}
      selection={selection}
      onSelectionChange={noop}
    />
  );
}

describe('SpendByCategoryChart', () => {
  it('shows each category’s share in both periods on one row', () => {
    renderPie(resource(CURRENT));

    // Food went 40% of last period to 75% of this one.
    const food = screen.getByText('Food').closest('li');
    expect(food).toHaveTextContent('40%');
    expect(food).toHaveTextContent('75%');
  });

  it('keeps a category that appears in only one of the two periods', () => {
    renderPie(resource(CURRENT));

    // Rent was 60% last period and is absent from this one. Dropping it would
    // hide the single biggest change the comparison exists to show.
    const rent = screen.getByText('Rent').closest('li');
    expect(rent).toHaveTextContent('60%');
    expect(rent).toHaveTextContent('0%');
  });

  it('keeps spend whose category was deleted visible as its own slice', () => {
    renderPie(resource(CURRENT));

    expect(screen.getByText('Uncategorised')).toBeInTheDocument();
  });

  it('names the window each pie covers', () => {
    renderPie(resource(CURRENT));

    // The left pie is the range before this one, of the same length. Built the
    // same way rather than hard-coded, so this holds in any locale.
    const full = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    // Intl separates the ends with thin spaces (U+2009); testing-library
    // normalises those to ordinary ones before matching, so the expectation has
    // to be normalised the same way or it can never match.
    const normalise = (value: string) => value.replace(/\s+/g, ' ');
    const july = normalise(full.formatRange(new Date(2026, 6, 1), new Date(2026, 6, 31)));
    const august = normalise(full.formatRange(new Date(2026, 7, 1), new Date(2026, 7, 31)));

    // July belongs to the left pie alone. August appears twice — the range
    // control names it too — which is the point: the right pie is the window
    // the control is set to, and the left is the one before it.
    expect(screen.getByText(july)).toBeInTheDocument();
    expect(screen.getAllByText(august)).toHaveLength(2);
  });

  it('totals each pie underneath it', () => {
    renderPie(resource(CURRENT));

    // 75 + 25 this period, 40 + 60 last — one total under each pie, and both
    // happen to come to the same figure.
    expect(screen.getAllByText('$100.00')).toHaveLength(2);
  });

  it('names the biggest few and gathers the tail into one row', () => {
    renderPie(resource(MANY), resource(MANY));

    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('Bills')).toBeInTheDocument();
    // Gym and Books are the tail, and the row says how many it stands for.
    expect(screen.queryByText('Gym')).toBeNull();
    expect(screen.getByText('Others (2)')).toBeInTheDocument();
  });

  it('keeps the gathered row’s own money exact', () => {
    renderPie(resource(MANY), resource(MANY));

    // 6.00 + 4.00, added in minor units rather than as floats.
    const others = screen.getByText('Others (2)').closest('li');
    expect(others).toHaveTextContent('$10.00 → $10.00');
  });

  it('leaves a short list alone rather than gathering a single row', () => {
    // Collapsing one category into "Others" hides its name and saves no space.
    renderPie(resource(CURRENT), resource(PREVIOUS));

    expect(screen.queryByText(/^Others/)).toBeNull();
  });

  it('says so when both periods are empty', () => {
    renderPie(resource({ ...CURRENT, categories: [] }), resource({ ...PREVIOUS, categories: [] }));

    expect(screen.getByText(/nothing spent in either period/i)).toBeInTheDocument();
  });

  it('surfaces a failed fetch instead of an empty state that looks like no spending', () => {
    renderPie(resource<CategoryBreakdown>(null, { error: 'Exchange rates are unavailable.' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/exchange rates/i);
  });

  it('does not pretend an empty selection means no spending', () => {
    renderPie(resource(CURRENT), resource(PREVIOUS), { ids: [], uncategorized: false });

    expect(screen.getByText(/no categories selected/i)).toBeInTheDocument();
  });
});
