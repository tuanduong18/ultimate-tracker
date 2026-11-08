import { DEFAULT_CATEGORY_COLOUR } from '@/lib/finance/category-colours';
import type { Category } from '@/lib/finance/types';

/**
 * A category as its form holds it, and what the form sends — the phone's copies of the web's
 * category-section.tsx rules, with one difference in the edit payload (below).
 */

export interface CategoryValues {
  name: string;
  colour: string;
  /** A key from the shared symbol list, or null for none (the badge shows the initial). */
  icon: string | null;
}

/** Where the form starts: the category's own values, or a blank one in the neutral Slate. */
export function categoryValues(category: Category | null | undefined): CategoryValues {
  return category
    ? { name: category.name, colour: category.colour, icon: category.icon }
    : { name: '', colour: DEFAULT_CATEGORY_COLOUR, icon: null };
}

/** What is wrong, field by field — checked on submit. The API caps names at 50 characters. */
export function categoryProblems(values: CategoryValues): { name?: string } {
  return values.name.trim() ? {} : { name: 'Enter a name for the category.' };
}

export function createPayload(values: CategoryValues) {
  return { name: values.name.trim(), colour: values.colour, icon: values.icon };
}

/**
 * What an edit sends: the name and colour always, and the symbol only when it changed.
 *
 * Leaving the symbol out keeps it, on the API's side. That matters for a key this phone doesn't
 * know — one the web added first — which would otherwise be sent back on every rename. Harmless
 * while the key is well formed; but one written outside the app that the API's shape check
 * refuses would make every rename fail, which sending only real changes can't.
 */
export function updatePayload(values: CategoryValues, stored: Category) {
  return {
    name: values.name.trim(),
    colour: values.colour,
    ...(values.icon !== stored.icon ? { icon: values.icon } : {}),
  };
}
