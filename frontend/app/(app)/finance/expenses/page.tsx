import type { Metadata } from 'next';

import { AllExpenses } from '@/components/finance/all-expenses';

export const metadata: Metadata = { title: 'Transactions' };

/** Every expense, not just the newest few the overview shows. */
export default function TransactionsPage() {
  return (
    // A list read row by row: past ~48rem the eye loses the line between the
    // description on the left and the amount on the right.
    <div className="max-w-3xl">
      <AllExpenses />
    </div>
  );
}
