import {
  ALL_CATEGORIES,
  firstCategoryId,
  initialOf,
  isEmptySelection,
  isNarrowed,
  preselectedCategoryId,
  selectionQuery,
} from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/types';

const category = (id: string, name: string): Category => ({
  id,
  name,
  colour: '#22c55e',
  icon: null,
  created_at: '2026-08-01T00:00:00Z',
});

describe('where a new entry starts', () => {
  it('starts an expense on the first category in the person’s order', () => {
    expect(firstCategoryId([category('c2', 'Rent'), category('c1', 'Food')])).toBe('c2');
    expect(firstCategoryId([])).toBe('');
  });

  it('starts a subscription on "Subscriptions" in any case, else the first', () => {
    const list = [category('c1', 'Food'), category('c9', ' SUBSCRIPTIONS ')];
    expect(preselectedCategoryId(list)).toBe('c9');
    expect(preselectedCategoryId([category('c1', 'Food')])).toBe('c1');
  });
});

describe('category selection', () => {
  it('sends nothing for everything', () => {
    expect(selectionQuery(ALL_CATEGORIES)).toBe('');
    expect(isNarrowed(ALL_CATEGORIES)).toBe(false);
  });

  it('sends each chosen id, and leaving out the bucket only when it is left out', () => {
    expect(selectionQuery({ ids: ['a', 'b'], uncategorized: true })).toBe(
      '&category_ids=a&category_ids=b'
    );
    expect(selectionQuery({ ids: null, uncategorized: false })).toBe(
      '&include_uncategorized=false'
    );
  });

  it('knows when nothing at all is chosen', () => {
    expect(isEmptySelection({ ids: [], uncategorized: false })).toBe(true);
    expect(isEmptySelection({ ids: [], uncategorized: true })).toBe(false);
  });
});

describe('initialOf', () => {
  it('takes the first letter or digit, upper-cased, past any emoji or punctuation', () => {
    expect(initialOf('food')).toBe('F');
    expect(initialOf('  ☕ coffee')).toBe('C');
    expect(initialOf('7-Eleven')).toBe('7');
    expect(initialOf('Ăn uống')).toBe('Ă');
    expect(initialOf('!!!')).toBe('?');
  });
});
