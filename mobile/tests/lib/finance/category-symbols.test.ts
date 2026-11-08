import { CATEGORY_SYMBOLS, symbolFor } from '@/lib/finance/category-symbols';

describe('the category-symbol dictionary', () => {
  it('holds exactly the shared list in finance.md § Category symbols, in the web’s order', () => {
    // The web maps these same keys, in this order; a change here is a change there too.
    expect(CATEGORY_SYMBOLS.map((symbol) => symbol.key)).toEqual([
      'food',
      'groceries',
      'coffee',
      'home',
      'bills',
      'utilities',
      'phone',
      'internet',
      'transport',
      'car',
      'fuel',
      'travel',
      'health',
      'fitness',
      'education',
      'books',
      'entertainment',
      'games',
      'music',
      'subscriptions',
      'shopping',
      'clothes',
      'gifts',
      'pets',
      'kids',
      'beauty',
      'insurance',
      'savings',
      'work',
      'other',
    ]);
  });

  it('draws each key with the Material Symbol finance.md names for the phone', () => {
    expect(symbolFor('food')?.icon).toBe('restaurant');
    expect(symbolFor('home')?.icon).toBe('home');
    expect(symbolFor('subscriptions')?.icon).toBe('autorenew');
    expect(symbolFor('other')?.icon).toBe('sell');
  });

  it('only uses keys the API accepts', () => {
    for (const { key } of CATEGORY_SYMBOLS) expect(key).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
  });

  it('includes every starter category’s symbol', () => {
    for (const key of ['food', 'home', 'education', 'entertainment', 'subscriptions', 'other']) {
      expect(symbolFor(key)?.key).toBe(key);
    }
  });

  it('knows nothing for no symbol or a key it has not been taught', () => {
    expect(symbolFor(null)).toBeNull();
    expect(symbolFor(undefined)).toBeNull();
    expect(symbolFor('car-wash')).toBeNull();
  });
});
