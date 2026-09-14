'use client';

import { useCallback } from 'react';

import { ExpenseSection } from '@/components/finance/expense-section';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type { Category, Expense } from '@/lib/types/finance';
import type { Profile } from '@/lib/types/profile';

/**
 * The full expense list, on its own page.
 *
 * Fetches its own copies rather than sharing the dashboard's: this is a separate
 * route, so there is no shared parent to hold them. Nothing on this page shows
 * a total, which is why no summary or breakdown is fetched here — the lists are
 * the whole page.
 */
export function AllExpenses() {
  const expenses = useCollection<Expense>('/finance/expenses');
  const categories = useCollection<Category>('/finance/categories');
  const currencies = useCollection<string>('/finance/currencies');
  const profile = useResource<Profile>('/auth/me');

  // Nothing on this page is an aggregate, so a write leaves nothing else stale.
  const onChange = useCallback(() => {}, []);

  return (
    <ExpenseSection
      expenses={expenses}
      categories={categories.items}
      currencies={currencies.items}
      defaultCurrency={profile.data?.display_currency ?? 'USD'}
      onChange={onChange}
      title="All expenses"
    />
  );
}
