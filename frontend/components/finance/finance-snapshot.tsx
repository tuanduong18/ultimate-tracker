'use client';

import { useState } from 'react';

import { SummaryTiles } from '@/components/finance/summary-tiles';
import { monthRange, sameDaysLastMonth, todayIso } from '@/lib/dates';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type { Subscription, Summary } from '@/lib/types/finance';

/**
 * The finance headline tiles, on their own, for the dashboard.
 *
 * Fetches just what the tiles need — two summaries and the subscription list —
 * rather than mounting the whole finance page's worth of requests to show
 * three numbers.
 */
export function FinanceSnapshot() {
  const [thisMonth] = useState(monthRange);
  const [lastMonthSoFar] = useState(() => sameDaysLastMonth());
  const [today] = useState(todayIso);

  const summary = useResource<Summary>(
    `/finance/summary?start_date=${thisMonth.start}&end_date=${thisMonth.end}`
  );
  const summaryBefore = useResource<Summary>(
    `/finance/summary?start_date=${lastMonthSoFar.start}&end_date=${lastMonthSoFar.end}`
  );
  const subscriptions = useCollection<Subscription>('/finance/subscriptions');

  return (
    <SummaryTiles
      current={summary}
      previous={summaryBefore}
      previousRange={lastMonthSoFar}
      subscriptions={subscriptions.items}
      subscriptionsLoading={subscriptions.loading}
      today={today}
    />
  );
}
