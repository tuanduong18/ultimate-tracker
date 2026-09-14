/**
 * The two chart panels, the range control and the category filter.
 *
 * jsdom gives every element zero size, so recharts' ResponsiveContainer draws
 * no SVG here and there is nothing useful to assert about arcs or bars. What is
 * worth pinning down is everything around them: which state a panel picks, that
 * the figures beside a chart are the API's own strings rather than anything
 * re-derived from the floats the chart is sized with, and that the two controls
 * hand back the windows and selections they claim to.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_CATEGORIES,
  CategoryFilter,
  isEmptySelection,
  selectionQuery,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { granularityFor, RangeControls, RangeNav } from '@/components/finance/range-control';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import type { DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import type { Category, CategoryBreakdown, PeriodBreakdown } from '@/lib/types/finance';

function resource<T>(data: T | null, rest: Partial<Resource<T>> = {}): Resource<T> {
  return { data, loading: false, error: null, reload: vi.fn(), setError: vi.fn(), ...rest };
}

const RANGE: DateRange = { start: '2026-08-01', end: '2026-08-31' };
const noop = () => {};

const FOOD: Category = {
  id: 'c1',
  name: 'Food',
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
};
const RENT: Category = {
  id: 'c2',
  name: 'Rent',
  colour: '#ef4444',
  created_at: '2026-08-01T00:00:00Z',
};

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

describe('RangeNav', () => {
  function renderNav(range: DateRange = RANGE) {
    const onChange = vi.fn();
    render(<RangeNav range={range} onChange={onChange} />);
    return onChange;
  }

  it('steps back by the range’s own length', () => {
    const onChange = renderNav();

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    // August is 31 days, so the previous window is the 31 days before it —
    // which is July 1st to 31st, not "last month" by name.
    expect(onChange).toHaveBeenCalledWith({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('steps forward by the same length, including for a hand-picked range', () => {
    const onChange = renderNav({ start: '2026-08-10', end: '2026-08-12' });

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-13', end: '2026-08-15' });
  });
});

describe('RangeControls', () => {
  function renderControls(range: DateRange = RANGE) {
    const onChange = vi.fn();
    render(<RangeControls range={range} onChange={onChange} idPrefix="test" />);
    return onChange;
  }

  it('lets either end of the range be typed directly', () => {
    const onChange = renderControls();

    fireEvent.change(screen.getByLabelText('Range start'), { target: { value: '2026-08-15' } });

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-15', end: '2026-08-31' });
  });

  it('marks the preset that matches the current range', () => {
    // The range here is a whole month, but not necessarily *this* month, so
    // neither preset should claim it.
    renderControls({ start: '2020-01-01', end: '2020-01-31' });

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CategoryFilter', () => {
  function renderFilter(selection: CategorySelection = ALL_CATEGORIES) {
    const onChange = vi.fn();
    render(
      <CategoryFilter
        categories={[FOOD, RENT]}
        selection={selection}
        onChange={onChange}
        idPrefix="test"
      />
    );
    return onChange;
  }

  it('starts with everything included and says so', () => {
    renderFilter();

    expect(screen.getByRole('button', { name: 'All categories' })).toBeInTheDocument();
  });

  it('counts what is hidden, so a filtered chart never looks unfiltered', () => {
    renderFilter({ ids: ['c1'], uncategorized: false });

    // Rent and the uncategorised bucket are both out.
    expect(screen.getByRole('button', { name: /2 hidden/ })).toBeInTheDocument();
  });

  it('pins the full list when only the uncategorised bucket is unticked', () => {
    const onChange = renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    fireEvent.click(screen.getByLabelText('Uncategorised'));

    // Left as null, "everything" would include the bucket again on the next
    // render and the tick would not stick.
    expect(onChange).toHaveBeenCalledWith({ ids: ['c1', 'c2'], uncategorized: false });
  });

  it('drops a category when its box is unticked', () => {
    const onChange = renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'All categories' }));
    fireEvent.click(screen.getByLabelText('Rent'));

    expect(onChange).toHaveBeenCalledWith({ ids: ['c1'], uncategorized: true });
  });
});

describe('selectionQuery', () => {
  it('sends nothing at all while everything is included', () => {
    // The API's own default is everything, and a category created since this
    // chart opened should still appear.
    expect(selectionQuery(ALL_CATEGORIES)).toBe('');
  });

  it('names each chosen category', () => {
    expect(selectionQuery({ ids: ['c1', 'c2'], uncategorized: true })).toBe(
      '&category_ids=c1&category_ids=c2'
    );
  });

  it('switches off the bucket that has no id to name it by', () => {
    expect(selectionQuery({ ids: null, uncategorized: false })).toBe(
      '&include_uncategorized=false'
    );
  });

  it('recognises a selection of nothing', () => {
    expect(isEmptySelection({ ids: [], uncategorized: false })).toBe(true);
    expect(isEmptySelection(ALL_CATEGORIES)).toBe(false);
    expect(isEmptySelection({ ids: [], uncategorized: true })).toBe(false);
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
