import type { Metadata } from 'next';

import { BudgetsView } from '@/components/finance/budgets-view';

export const metadata: Metadata = { title: 'Budgets' };

export default function BudgetsPage() {
  return (
    <div className="max-w-3xl">
      <BudgetsView />
    </div>
  );
}
