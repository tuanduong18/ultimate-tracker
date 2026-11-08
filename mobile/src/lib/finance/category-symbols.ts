import type { IconName } from '@/components/icon';

/**
 * The phone's half of the category-symbol dictionary: each stored key and the Material Symbol
 * that draws it. The keys are the shared list in docs/features/finance.md § Category symbols —
 * the web maps the same keys to lucide in frontend/lib/category-symbols.ts — so **a key added
 * here is added there too**, in the same change. Labels are the web's, word for word.
 *
 * In code, not in the database: a stored key is ours, so either app can change its icon set
 * without touching anyone's data. The API checks only a key's shape; a key this map doesn't know
 * yet (added on the web first, say) draws the category's initial instead.
 *
 * Ordered as the picker shows them, as on the web: food, home, getting around, health and
 * learning, leisure, things, the rest. `IconName` makes a misspelt symbol fail type-checking.
 */
export interface CategorySymbol {
  key: string;
  /** The symbol's name — the picker's accessible label. */
  label: string;
  icon: IconName;
}

export const CATEGORY_SYMBOLS = [
  { key: 'food', label: 'Food', icon: 'restaurant' },
  { key: 'groceries', label: 'Groceries', icon: 'shopping_cart' },
  { key: 'coffee', label: 'Coffee', icon: 'local_cafe' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'bills', label: 'Bills', icon: 'receipt_long' },
  { key: 'utilities', label: 'Utilities', icon: 'bolt' },
  { key: 'phone', label: 'Phone', icon: 'smartphone' },
  { key: 'internet', label: 'Internet', icon: 'wifi' },
  { key: 'transport', label: 'Transport', icon: 'directions_bus' },
  { key: 'car', label: 'Car', icon: 'directions_car' },
  { key: 'fuel', label: 'Fuel', icon: 'local_gas_station' },
  { key: 'travel', label: 'Travel', icon: 'flight' },
  { key: 'health', label: 'Health', icon: 'health_and_safety' },
  { key: 'fitness', label: 'Fitness', icon: 'fitness_center' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'books', label: 'Books', icon: 'menu_book' },
  { key: 'entertainment', label: 'Entertainment', icon: 'movie' },
  { key: 'games', label: 'Games', icon: 'sports_esports' },
  { key: 'music', label: 'Music', icon: 'music_note' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'autorenew' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping_bag' },
  { key: 'clothes', label: 'Clothes', icon: 'checkroom' },
  { key: 'gifts', label: 'Gifts', icon: 'redeem' },
  { key: 'pets', label: 'Pets', icon: 'pets' },
  { key: 'kids', label: 'Kids', icon: 'child_care' },
  { key: 'beauty', label: 'Beauty', icon: 'spa' },
  { key: 'insurance', label: 'Insurance', icon: 'shield' },
  { key: 'savings', label: 'Savings', icon: 'savings' },
  { key: 'work', label: 'Work', icon: 'work' },
  { key: 'other', label: 'Other', icon: 'sell' },
] as const satisfies readonly CategorySymbol[];

const BY_KEY = new Map<string, CategorySymbol>(
  CATEGORY_SYMBOLS.map((symbol) => [symbol.key, symbol])
);

/** The symbol for a stored key, or null for none — and for a key this app doesn't know yet. */
export function symbolFor(key: string | null | undefined): CategorySymbol | null {
  return (key && BY_KEY.get(key)) || null;
}
