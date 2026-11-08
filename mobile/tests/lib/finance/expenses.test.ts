import {
  expenseLines,
  expenseName,
  expensePayload,
  expenseProblems,
  expenseValues,
} from '@/lib/finance/expenses';
import type { Category, Expense } from '@/lib/finance/types';

const FOOD: Category = {
  id: 'food',
  name: 'Food',
  colour: '#22c55e',
  icon: 'food',
  created_at: '2026-08-01T00:00:00Z',
};

const LUNCH: Expense = {
  id: 'e1',
  amount: '12.500',
  currency: 'SGD',
  category_id: 'food',
  description: 'Lunch',
  spent_on: '2026-11-03',
  created_at: '2026-11-03T04:00:00Z',
};

const DEFAULTS = { currency: 'SGD', categoryId: 'food', today: '2026-11-07' };

describe('expenseValues', () => {
  it('starts a new expense empty, in the person’s currency, on their first category, today', () => {
    expect(expenseValues(null, DEFAULTS)).toEqual({
      amount: '',
      currency: 'SGD',
      category_id: 'food',
      description: '',
      spent_on: '2026-11-07',
    });
  });

  it('starts an edit from what was stored, with no category as Uncategorised', () => {
    expect(expenseValues({ ...LUNCH, category_id: null, description: null }, DEFAULTS)).toEqual({
      amount: '12.500',
      currency: 'SGD',
      category_id: '',
      description: '',
      spent_on: '2026-11-03',
    });
  });
});

describe('expensePayload', () => {
  it('sends what the web sends, empty optional fields as explicit nulls', () => {
    expect(
      expensePayload({
        amount: ' 12.5 ',
        currency: 'SGD',
        category_id: '',
        description: '   ',
        spent_on: '2026-11-07',
      })
    ).toEqual({
      amount: '12.5',
      currency: 'SGD',
      category_id: null,
      description: null,
      spent_on: '2026-11-07',
    });
  });
});

describe('expenseProblems', () => {
  it('asks for an amount in the shared words', () => {
    expect(expenseProblems({ ...expenseValues(null, DEFAULTS) })).toEqual({
      amount: 'Enter an amount like 12.50.',
    });
    expect(expenseProblems({ ...expenseValues(LUNCH, DEFAULTS) })).toEqual({});
  });
});

describe('how a row reads', () => {
  it('leads with the description, then the category and date', () => {
    expect(expenseLines(LUNCH, FOOD)).toMatchObject({
      title: 'Lunch',
      detail: expect.stringMatching(/^Food · /),
    });
  });

  it('leads with the category when there is no description, never "No description"', () => {
    const lines = expenseLines({ ...LUNCH, description: null }, FOOD);
    expect(lines.title).toBe('Food');
    expect(lines.detail).not.toMatch(/Food|description/);
  });

  it('calls an expense with no category Uncategorised', () => {
    expect(expenseLines({ ...LUNCH, category_id: null, description: null }, undefined).title).toBe(
      'Uncategorised'
    );
    expect(expenseName({ ...LUNCH, description: null }, undefined)).toMatch(
      /^Uncategorised expense, /
    );
  });
});
