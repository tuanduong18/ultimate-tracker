import type { Metadata } from 'next';

import { SubscriptionsView } from '@/components/finance/subscriptions-view';

export const metadata: Metadata = { title: 'Subscriptions' };

export default function SubscriptionsPage() {
  return (
    <div className="max-w-3xl">
      <SubscriptionsView />
    </div>
  );
}
