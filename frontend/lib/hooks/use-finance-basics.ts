'use client';

import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type { Category } from '@/lib/types/finance';
import type { Profile } from '@/lib/types/profile';

/**
 * The reference data every finance form needs: categories to pick from,
 * currencies to price in, and the currency a new entry starts in.
 *
 * Each finance tab is its own route with no shared parent to hold these, so
 * each fetches its own copy; this keeps the three requests and the fallback
 * in one place instead of five.
 */
export function useFinanceBasics() {
  const categories = useCollection<Category>('/finance/categories');
  const currencies = useCollection<string>('/finance/currencies');
  const profile = useResource<Profile>('/auth/me');

  return {
    /** True until all three have answered once — a form opened before then would
     * start in the wrong currency with an empty category list. */
    loading: categories.loading || currencies.loading || profile.loading,
    categories,
    currencies: currencies.items,
    // What new entries start in — the preferred currency, not the one totals
    // are reported in. USD only until /auth/me lands.
    defaultCurrency: profile.data?.preferred_currency ?? 'USD',
  };
}
