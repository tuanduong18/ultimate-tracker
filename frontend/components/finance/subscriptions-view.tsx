'use client';

import { useCallback } from 'react';

import { SubscriptionSection } from '@/components/finance/subscription-section';
import { useCollection } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import type { Subscription } from '@/lib/types/finance';

/** The Subscriptions tab: every recurring charge, with its next billing date. */
export function SubscriptionsView() {
  const subscriptions = useCollection<Subscription>('/finance/subscriptions');
  const { categories, currencies, defaultCurrency } = useFinanceBasics();
  // Editing a subscription writes no expense, and renewing one early
  // announces the expense it writes itself, so nothing else is owed here.
  const onChange = useCallback(() => {}, []);

  return (
    <SubscriptionSection
      subscriptions={subscriptions}
      categories={categories.items}
      currencies={currencies}
      defaultCurrency={defaultCurrency}
      onChange={onChange}
    />
  );
}
