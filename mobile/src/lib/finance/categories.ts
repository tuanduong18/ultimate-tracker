import type { Category } from '@/lib/finance/types';

/**
 * Rules about categories that every screen shares — the phone's copies of the web's
 * `firstCategoryId` (category-options.tsx), `preselectedCategoryId` (subscription-form.tsx) and
 * the category selection of category-filter.tsx.
 */

/** What a row says when its expense has no category — the word the web draws too. */
export const UNCATEGORISED = 'Uncategorised';

/** The first letter or digit of a name, upper-cased — "?" when it has none. A badge's fallback. */
export function initialOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
}

/**
 * Where a new expense starts: the top of the person's own order, so the category they put
 * first is one tap away — or Uncategorised ('') only when they have none.
 */
export function firstCategoryId(categories: readonly Category[]): string {
  return categories[0]?.id ?? '';
}

/**
 * Where a new subscription starts: the category named "Subscriptions" if there is one (any case),
 * since that is what most people file them under, else the first in their order.
 */
export function preselectedCategoryId(categories: readonly Category[]): string {
  return (
    categories.find((c) => c.name.trim().toLowerCase() === 'subscriptions')?.id ??
    firstCategoryId(categories)
  );
}

/**
 * Which categories a chart or filter counts.
 *
 * `ids: null` means every category, including ones made later — not "every one ticked", which
 * would quietly miss tomorrow's. `uncategorized` is the bucket of spend whose category was
 * deleted; it has no id, so it is a flag of its own.
 */
export interface CategorySelection {
  ids: string[] | null;
  uncategorized: boolean;
}

export const ALL_CATEGORIES: CategorySelection = { ids: null, uncategorized: true };

/** The selection as the summary endpoints' query string: "&category_ids=…&include_uncategorized=false". */
export function selectionQuery(selection: CategorySelection): string {
  const parts = (selection.ids ?? []).map((id) => `category_ids=${encodeURIComponent(id)}`);
  // Only worth sending when it differs from the server's default. With no ids alongside it, the
  // API reads it as "every named category, minus the bucket".
  if (!selection.uncategorized) parts.push('include_uncategorized=false');
  return parts.length ? `&${parts.join('&')}` : '';
}

/**
 * Nothing chosen at all. A query string cannot say "no categories" — no ids means all of them —
 * so a chart skips the request and says so instead.
 */
export function isEmptySelection(selection: CategorySelection): boolean {
  return selection.ids !== null && selection.ids.length === 0 && !selection.uncategorized;
}

/** True when the selection is anything other than everything. */
export function isNarrowed(selection: CategorySelection): boolean {
  return selection.ids !== null || !selection.uncategorized;
}
