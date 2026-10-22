/**
 * The category rings: each period's mix, and how it moved.
 *
 * jsdom gives every element zero size, so recharts draws no SVG here, and it
 * applies no CSS, so container queries do not hide the left ring either — both
 * rings are always in the DOM in these tests. What is worth pinning down is
 * what a person reads: the legend, the totals in the holes, the states, and
 * that every figure is the API's own string rather than a float round trip.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ALL_CATEGORIES, type CategorySelection } from '@/components/finance/category-filter';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { formatRange, shiftRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import type { CategoryBreakdown } from '@/lib/types/finance';
import { FOOD, RANGE, RENT, noop, resource } from '@/tests/support/finance';

const AUGUST: CategoryBreakdown = {
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '75.000' },
    { category_id: null, name: 'Uncategorised', colour: '#e5e7eb', spent: '25.000' },
  ],
};

const JULY: CategoryBreakdown = {
  ...AUGUST,
  starts_on: '2026-07-01',
  ends_on: '2026-07-31',
  categories: [
    { category_id: 'c1', name: 'Food', colour: '#22c55e', spent: '40.000' },
    { category_id: 'c2', name: 'Rent', colour: '#ef4444', spent: '60.000' },
  ],
};

/** Six categories, which is one more than the rings name. */
const MANY: CategoryBreakdown = {
  ...AUGUST,
  categories: [
    { category_id: 'c1', name: 'Rent', colour: '#ef4444', spent: '50.00' },
    { category_id: 'c2', name: 'Food', colour: '#22c55e', spent: '20.00' },
    { category_id: 'c3', name: 'Travel', colour: '#3b82f6', spent: '10.00' },
    { category_id: 'c4', name: 'Bills', colour: '#a855f7', spent: '10.00' },
    { category_id: 'c5', name: 'Gym', colour: '#f59e0b', spent: '6.00' },
    { category_id: 'c6', name: 'Books', colour: '#14b8a6', spent: '4.00' },
  ],
};

function renderRings(
  current: Resource<CategoryBreakdown>,
  previous: Resource<CategoryBreakdown> = resource(JULY),
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

function row(name: string) {
  return screen.getByText(name).closest('li')!;
}

describe('SpendByCategoryChart', () => {
  it('shows each category’s share last period and this one, then this period’s amount', () => {
    renderRings(resource(AUGUST));

    // Food was 40 of July's 100 and is 75 of August's 100.
    expect(row('Food')).toHaveTextContent('40% of last period, 75% of this period');
    expect(row('Food')).toHaveTextContent('$75.00');
  });

  it('keeps a category that appears in only one of the two periods', () => {
    renderRings(resource(AUGUST));

    // Rent was 60% of July and is absent from August — the single biggest
    // change in the mix, which dropping it would hide.
    expect(row('Rent')).toHaveTextContent('60% of last period, 0% of this period');
  });

  it('names each ring’s window and puts its total in the hole', () => {
    renderRings(resource(AUGUST));

    const [before, now] = screen.getAllByRole('figure');
    expect(within(before).getByText('$100.00')).toBeInTheDocument();
    expect(within(now).getByText('$100.00')).toBeInTheDocument();
    // Left is the window before the one the range control is set to; right is
    // it. Compared raw: Intl separates the ends with thin spaces, which
    // toHaveTextContent would normalise on one side only.
    expect(before.querySelector('figcaption')?.textContent).toBe(
      formatRange(shiftRange(RANGE, -1))
    );
    expect(now.querySelector('figcaption')?.textContent).toBe(formatRange(RANGE));
  });

  it('keeps an empty period as a ring that says so, beside one that is not', () => {
    renderRings(resource({ ...AUGUST, categories: [] }));

    const [, now] = screen.getAllByRole('figure');
    expect(within(now).getByText('nothing yet')).toBeInTheDocument();
    expect(within(now).getByText('$0.00')).toBeInTheDocument();
  });

  it('shows spend with no category in grey, not the near-white the API sends', () => {
    renderRings(resource(AUGUST));

    const swatch = screen.getByText('Uncategorised').previousElementSibling as HTMLElement;
    expect(swatch.style.backgroundColor).toBe('rgb(148, 163, 184)');
  });

  it('names the biggest few and gathers the tail into one row', () => {
    renderRings(resource(MANY), resource(MANY));

    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('Bills')).toBeInTheDocument();
    // Gym and Books are the tail, and the row says how many it stands for.
    expect(screen.queryByText('Gym')).toBeNull();
    expect(screen.getByText('Others (2)')).toBeInTheDocument();
  });

  it('keeps the gathered row’s own money exact', () => {
    renderRings(resource(MANY), resource(MANY));

    // 6.00 + 4.00, added in minor units rather than as floats.
    expect(row('Others (2)')).toHaveTextContent('$10.00');
  });

  it('leaves a short list alone rather than gathering a single row', () => {
    // Collapsing one category into "Others" hides its name and saves no space.
    renderRings(resource(AUGUST));

    expect(screen.queryByText(/^Others/)).toBeNull();
  });

  it('says so when both periods are empty', () => {
    renderRings(resource({ ...AUGUST, categories: [] }), resource({ ...JULY, categories: [] }));

    expect(screen.getByText(/nothing spent in .* or the period before/i)).toBeInTheDocument();
  });

  it('surfaces a failed fetch instead of an empty state that looks like no spending', () => {
    renderRings(resource<CategoryBreakdown>(null, { error: 'Exchange rates are unavailable.' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/exchange rates/i);
  });

  it('does not pretend an empty selection means no spending', () => {
    renderRings(resource(AUGUST), resource(JULY), { ids: [], uncategorized: false });

    expect(screen.getByText(/no categories selected/i)).toBeInTheDocument();
  });
});
