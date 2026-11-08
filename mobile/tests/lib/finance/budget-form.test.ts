import {
  budgetPayload,
  budgetProblems,
  budgetValues,
  withPeriod,
  type BudgetValues,
} from '@/lib/finance/budget-form';
import type { Budget } from '@/lib/finance/types';

const DEFAULTS = { currency: 'SGD', month: '2026-11-01', hasCategories: true };

const FILLED: BudgetValues = {
  ...budgetValues(null, DEFAULTS),
  name: 'Eating out',
  amount: '300',
  category_ids: ['food'],
};

describe('budgetValues', () => {
  it('starts a new budget monthly, from the month on screen, warning at 80%, over chosen categories', () => {
    expect(budgetValues(null, { ...DEFAULTS, month: '2026-12-15' })).toEqual({
      period: 'monthly',
      name: '',
      amount: '',
      currency: 'SGD',
      starts_on: '2026-12-01',
      ends_on: '',
      all_spending: false,
      category_ids: [],
      warn_at_percent: 80,
    });
  });

  it('starts over all spending when there are no categories to choose', () => {
    expect(budgetValues(null, { ...DEFAULTS, hasCategories: false }).all_spending).toBe(true);
  });

  it('holds a stored monthly budget’s last month by its 1st', () => {
    const stored = {
      id: 'b1',
      name: 'Food',
      amount: '300.000',
      currency: 'SGD',
      period: 'monthly',
      starts_on: '2026-10-01',
      ends_on: '2026-12-31',
      warn_at_percent: null,
      all_spending: false,
      categories: [{ id: 'food' }],
      created_at: '2026-10-01T00:00:00Z',
    } as Budget;
    expect(budgetValues(stored, DEFAULTS)).toMatchObject({
      ends_on: '2026-12-01',
      category_ids: ['food'],
      warn_at_percent: null,
    });
  });
});

describe('withPeriod', () => {
  it('snaps the dates to months for monthly, and asks for a fresh end for custom', () => {
    const custom = {
      ...FILLED,
      period: 'custom' as const,
      starts_on: '2026-11-18',
      ends_on: '2026-12-02',
    };
    expect(withPeriod(custom, 'monthly')).toMatchObject({
      starts_on: '2026-11-01',
      ends_on: '2026-12-01',
    });
    expect(withPeriod(FILLED, 'custom')).toMatchObject({ period: 'custom', ends_on: '' });
  });
});

describe('budgetProblems', () => {
  it('accepts a complete budget', () => {
    expect(budgetProblems(FILLED)).toEqual({});
  });

  it('says what each missing or wrong field needs, in the web’s words', () => {
    expect(budgetProblems(budgetValues(null, DEFAULTS))).toEqual({
      name: 'Enter a name for the budget.',
      amount: 'Enter an amount like 12.50.',
      category_ids: 'Pick at least one category, or choose All spending.',
    });
    expect(budgetProblems({ ...FILLED, period: 'custom', ends_on: '' }).ends_on).toBe(
      'A custom budget needs an end date.'
    );
    expect(budgetProblems({ ...FILLED, ends_on: '2026-10-01' }).ends_on).toBe(
      'The last month must be on or after the first.'
    );
  });
});

describe('budgetPayload', () => {
  it('sends an ongoing budget and no early warning as explicit nulls', () => {
    expect(budgetPayload({ ...FILLED, warn_at_percent: null })).toEqual({
      name: 'Eating out',
      amount: '300',
      currency: 'SGD',
      period: 'monthly',
      starts_on: '2026-11-01',
      ends_on: null,
      all_spending: false,
      category_ids: ['food'],
      warn_at_percent: null,
    });
  });

  it('leaves the categories out of an all-spending budget, which can’t have both', () => {
    expect(budgetPayload({ ...FILLED, all_spending: true })).not.toHaveProperty('category_ids');
  });
});
