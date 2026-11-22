import {
  ALL_CATEGORIES,
  firstCategoryId,
  hiddenBy,
  initialOf,
  isEmptySelection,
  isNarrowed,
  listNames,
  preselectedCategoryId,
  sameIds,
  savedHidden,
  savedSelection,
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

describe('the categories the charts start without', () => {
  const FOOD = category('food', 'Food');
  const RENT = category('rent', 'Rent');

  it('opens the charts on every category, now and later, when nothing is hidden', () => {
    expect(savedSelection([FOOD, RENT], [])).toBe(ALL_CATEGORIES);
    // An id whose category was deleted since hides nothing.
    expect(savedSelection([FOOD, RENT], ['gone'])).toBe(ALL_CATEGORIES);
  });

  it('opens the charts without what is hidden, Uncategorised still in', () => {
    expect(savedSelection([FOOD, RENT], ['rent'])).toEqual({ ids: ['food'], uncategorized: true });
  });

  it('reads back what a selection leaves out, in the person’s order', () => {
    expect(hiddenBy(ALL_CATEGORIES, [FOOD, RENT])).toEqual([]);
    expect(hiddenBy({ ids: [], uncategorized: true }, [FOOD, RENT])).toEqual(['food', 'rent']);
    expect(hiddenBy({ ids: ['rent'], uncategorized: false }, [FOOD, RENT])).toEqual(['food']);
  });

  it('keeps only saved ids that still name a category, and compares lists in any order', () => {
    expect(savedHidden([FOOD, RENT], ['gone', 'rent'])).toEqual(['rent']);
    expect(sameIds(['food', 'rent'], ['rent', 'food'])).toBe(true);
    expect(sameIds(['food'], ['food', 'rent'])).toBe(false);
  });

  it('names categories in a sentence, as the web does', () => {
    expect(listNames(['Rent'])).toBe('Rent');
    expect(listNames(['Rent', 'Food'])).toBe('Rent and Food');
    expect(listNames(['Rent', 'Food', 'Travel'])).toBe('Rent, Food and Travel');
  });
});
