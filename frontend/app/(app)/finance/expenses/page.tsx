/**
 * Every expense, not just the newest few the dashboard panel shows.
 *
 * Deliberately thin for now — the dashboard's "See all" needs somewhere to go,
 * and filters and paging belong to a later pass.
 */

import Link from 'next/link';

import { AllExpenses } from '@/components/finance/all-expenses';

export default function AllExpensesPage() {
  return (
    <main className="p-8">
      <Link href="/finance" className="text-sm text-fg-muted underline">
        ← Finance
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Expenses</h1>
      <p className="mt-2 text-sm text-fg-muted">Everything you have logged, newest first.</p>

      <div className="mt-6">
        <AllExpenses />
      </div>
    </main>
  );
}
