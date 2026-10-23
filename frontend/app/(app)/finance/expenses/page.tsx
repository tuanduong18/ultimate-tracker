import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AllExpenses } from '@/components/finance/all-expenses';
import { PanelNote } from '@/components/finance/panel';

export const metadata: Metadata = { title: 'Transactions' };

/** Every expense, not just the newest few the overview shows. */
export default function TransactionsPage() {
  return (
    // A list read row by row: past ~48rem the eye loses the line between the
    // description on the left and the amount on the right.
    <div className="max-w-3xl">
      {/* AllExpenses reads its filters from the URL (useSearchParams), which a
          prerendered page only has in the browser; the boundary keeps the rest
          of the page static. */}
      <Suspense fallback={<PanelNote>Loading…</PanelNote>}>
        <AllExpenses />
      </Suspense>
    </div>
  );
}
