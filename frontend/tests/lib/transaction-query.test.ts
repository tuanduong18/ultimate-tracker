import { describe, expect, it } from 'vitest';

import {
  amountLabel,
  dateLabel,
  describeFilters,
  fromParams,
  isFiltered,
  matcher,
  NO_FILTERS,
  readAmount,
  toParams,
  totalsByCurrency,
  type TransactionFilters,
} from '@/components/finance/transaction-query';
import type { Expense } from '@/lib/types/finance';
import { FOOD, RENT } from '../support/finance';

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

  it('finds the phrase as typed, anywhere, in any case — like Ctrl+F', () => {
    expect(ids({ q: 'FOOD DIN' })).toEqual(['grab']);
    expect(ids({ q: '  grab  ' })).toEqual(['grab', 'ride']);
    // A phrase, not a bag of words: order matters.
    expect(ids({ q: 'dinner grab' })).toEqual([]);
  });

  it('searches category names as well as descriptions', () => {
    expect(ids({ q: 'rent' })).toEqual(['rent']);
  });

  it('finds rows with no category by the label they show, in either spelling', () => {
    expect(ids({ q: 'uncategorised' })).toEqual(['ride', 'pho']);
    expect(ids({ q: 'Uncategorized' })).toEqual(['ride', 'pho']);
  });

  it('finds dates and amounts as written on the row', () => {
    expect(ids({ q: '8.50' })).toEqual(['ride']);
    expect(ids({ q: '2026-07-31' })).toEqual(['ride']);
    expect(ids({ q: 'jul' })).toEqual(['ride']);
  });

  it('does not match across the gap between two fields', () => {
    // "GrabFood dinner" then category "Food": joined, this would match.
    expect(ids({ q: 'dinner food' })).toEqual([]);
  });

  it('takes the search literally, so regex characters are just characters', () => {
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

  it('ignores a range without a currency, and an upper bound below the lower', () => {
    expect(ids({ min: '100' })).toEqual(['grab', 'ride', 'rent', 'pho']);
    expect(ids({ currency: 'USD', min: '20', max: '1' })).toEqual(['grab', 'rent']);
  });

  it('ignores a bound that is not a number yet', () => {
    expect(ids({ currency: 'USD', min: '12.' })).toEqual(['grab', 'ride', 'rent']);
  });
});

describe('readAmount', () => {
  it('forgives separators and symbols, and rejects what it cannot read', () => {
    expect(readAmount(' 1,200 ')).toBe('1200');
    expect(readAmount('$40')).toBe('40');
    expect(readAmount('12.5')).toBe('12.5');
    expect(readAmount('')).toBeNull();
    expect(readAmount('abc')).toBeNull();
  });
});

describe('URL round trip', () => {
  it('writes nothing while nothing is filtered', () => {
    expect(toParams(NO_FILTERS).toString()).toBe('');
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it('reads back what it wrote', () => {
    const filters: TransactionFilters = {
      q: 'grab',
      start: '2026-08-01',
      end: '2026-08-31',
      categories: { ids: [FOOD.id, RENT.id], uncategorized: false },
      currency: 'USD',
      min: '10',
      max: '50',
    };
    expect(fromParams(toParams(filters))).toEqual(filters);
  });

  it('keeps an empty category pick empty, rather than reading it as all', () => {
    const none: TransactionFilters = {
      ...NO_FILTERS,
      categories: { ids: [], uncategorized: false },
    };
    expect(fromParams(toParams(none)).categories).toEqual({ ids: [], uncategorized: false });
  });
});

describe('totalsByCurrency', () => {
  it('adds exactly, one total per currency, most-used first', () => {
    const totals = totalsByCurrency([
      expense({ amount: '0.100' }),
      expense({ amount: '0.200' }),
      expense({ amount: '99999999999999.990', currency: 'VND' }),
    ]);
    // 0.1 + 0.2 as floats is 0.30000000000000004.
    expect(totals).toEqual([
      { currency: 'USD', total: '0.300' },
      { currency: 'VND', total: '99999999999999.990' },
    ]);
  });

  it('carries across the decimal point and into a new digit', () => {
    expect(
      totalsByCurrency([expense({ amount: '9.999' }), expense({ amount: '990.001' })])
    ).toEqual([{ currency: 'USD', total: '1000.000' }]);
  });

  it('is empty for no rows', () => {
    expect(totalsByCurrency([])).toEqual([]);
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

  it('describes the filters for the export in the same words', () => {
    const lines = describeFilters(
      { ...NO_FILTERS, q: 'grab', categories: { ids: [FOOD.id], uncategorized: true } },
      [FOOD, RENT]
    );
    expect(lines).toEqual(['Search: grab', 'Categories: Food, Uncategorised']);
    expect(describeFilters(NO_FILTERS, [])).toEqual([]);
  });
});
