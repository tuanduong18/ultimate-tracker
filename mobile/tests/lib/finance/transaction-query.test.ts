import {
  amountLabel,
  categoryLabel,
  dateLabel,
  isFiltered,
  matcher,
  NO_FILTERS,
  readAmount,
  totalsByCurrency,
  type TransactionFilters,
} from '@/lib/finance/transaction-query';
import type { Category, Expense } from '@/lib/finance/types';

const FOOD: Category = {
  id: 'food',
  name: 'Food',
  colour: '#22c55e',
  icon: 'food',
  created_at: '2026-08-01T00:00:00Z',
};
const RENT: Category = { ...FOOD, id: 'rent', name: 'Rent', icon: 'home' };

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e',
    amount: '10.000',
    currency: 'USD',
    category_id: null,
    description: null,
    spent_on: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    ...overrides,
  };
}

const ROWS = [
  expense({ id: 'grab', description: 'GrabFood dinner', category_id: FOOD.id, amount: '25.000' }),
  expense({ id: 'ride', description: 'Grab ride home', spent_on: '2026-07-31', amount: '8.500' }),
  expense({ id: 'rent', description: 'August', category_id: RENT.id, amount: '900.000' }),
  expense({ id: 'pho', description: 'Phở', currency: 'VND', amount: '50000.000' }),
];

function ids(filters: Partial<TransactionFilters>): string[] {
  return ROWS.filter(matcher({ ...NO_FILTERS, ...filters }, [FOOD, RENT])).map((e) => e.id);
}

describe('matcher', () => {
  it('matches everything with no filters', () => {
    expect(ids({})).toEqual(['grab', 'ride', 'rent', 'pho']);
  });

  it('finds the phrase as typed, anywhere, in any case', () => {
    expect(ids({ q: 'FOOD DIN' })).toEqual(['grab']);
    expect(ids({ q: '  grab  ' })).toEqual(['grab', 'ride']);
    expect(ids({ q: 'dinner grab' })).toEqual([]);
  });

  it('searches category names, and finds rows with none by the label they show', () => {
    expect(ids({ q: 'rent' })).toEqual(['rent']);
    expect(ids({ q: 'uncategorised' })).toEqual(['ride', 'pho']);
    expect(ids({ q: 'Uncategorized' })).toEqual(['ride', 'pho']);
  });

  it('finds dates and amounts as written on the row', () => {
    expect(ids({ q: '8.50' })).toEqual(['ride']);
    expect(ids({ q: '2026-07-31' })).toEqual(['ride']);
  });

  it('does not match across the gap between two fields, or treat the search as a pattern', () => {
    expect(ids({ q: 'dinner food' })).toEqual([]);
    expect(ids({ q: '.*' })).toEqual([]);
  });

  it('keeps dates inclusive and either end open', () => {
    expect(ids({ start: '2026-08-01' })).toEqual(['grab', 'rent', 'pho']);
    expect(ids({ end: '2026-07-31' })).toEqual(['ride']);
  });

  it('filters by category, with uncategorised rows switched separately', () => {
    expect(ids({ categories: { ids: [FOOD.id], uncategorized: false } })).toEqual(['grab']);
    expect(ids({ categories: { ids: null, uncategorized: false } })).toEqual(['grab', 'rent']);
    expect(ids({ categories: { ids: [], uncategorized: true } })).toEqual(['ride', 'pho']);
  });

  it('compares amounts inclusively, as recorded, in the chosen currency', () => {
    expect(ids({ currency: 'USD', min: '8.5', max: '25' })).toEqual(['grab', 'ride']);
    expect(ids({ currency: 'VND' })).toEqual(['pho']);
  });

  it('ignores a range without a currency, an inverted upper bound, and a half-typed one', () => {
    expect(ids({ min: '100' })).toEqual(['grab', 'ride', 'rent', 'pho']);
    expect(ids({ currency: 'USD', min: '20', max: '1' })).toEqual(['grab', 'rent']);
    expect(ids({ currency: 'USD', min: '12.' })).toEqual(['grab', 'ride', 'rent']);
  });
});

describe('readAmount', () => {
  it('forgives separators and symbols, and rejects what it cannot read', () => {
    expect(readAmount(' 1,200 ')).toBe('1200');
    expect(readAmount('$40')).toBe('40');
    expect(readAmount('')).toBeNull();
    expect(readAmount('abc')).toBeNull();
  });
});

describe('isFiltered', () => {
  it('is false for nothing and true for each kind of narrowing', () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, q: '  ' })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, q: 'grab' })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, end: '2026-08-01' })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, categories: { ids: [], uncategorized: true } })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, currency: 'USD' })).toBe(true);
  });
});

describe('totalsByCurrency', () => {
  it('adds exactly, one total per currency, most-used first', () => {
    expect(
      totalsByCurrency([
        expense({ amount: '0.100' }),
        expense({ amount: '0.200' }),
        expense({ amount: '99999999999999.990', currency: 'VND' }),
      ])
    ).toEqual([
      { currency: 'USD', total: '0.300' },
      { currency: 'VND', total: '99999999999999.990' },
    ]);
  });

  it('carries across the decimal point and into a new digit', () => {
    expect(
      totalsByCurrency([expense({ amount: '9.999' }), expense({ amount: '990.001' })])
    ).toEqual([{ currency: 'USD', total: '1000.000' }]);
  });
});

describe('labels', () => {
  const today = new Date(2026, 9, 23);

  it('names presets, ranges and open ends', () => {
    expect(dateLabel(NO_FILTERS, today)).toBe('Any time');
    expect(dateLabel({ ...NO_FILTERS, start: '2026-09-01', end: '2026-09-30' }, today)).toBe(
      'Last month'
    );
    expect(dateLabel({ ...NO_FILTERS, start: '2026-03-01' }, today)).toMatch(/^From /);
  });

  it('says what an amount filter is doing', () => {
    expect(amountLabel(NO_FILTERS)).toBe('Any amount');
    expect(amountLabel({ ...NO_FILTERS, currency: 'USD' })).toBe('USD only');
    expect(amountLabel({ ...NO_FILTERS, currency: 'USD', max: '5' })).toMatch(/^Up to /);
  });

  it('counts the categories a filter hides, the bucket included', () => {
    expect(categoryLabel(NO_FILTERS.categories, [FOOD, RENT])).toBe('All categories');
    expect(categoryLabel({ ids: [FOOD.id], uncategorized: false }, [FOOD, RENT])).toBe(
      'Categories · 2 hidden'
    );
  });
});
