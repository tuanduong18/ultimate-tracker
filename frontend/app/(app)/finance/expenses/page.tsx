/**
 * Every expense, not just the newest few the dashboard panel shows.
 *
 * Deliberately thin for now — the dashboard's "See all" needs somewhere to go,
 * and filters and paging belong to a later pass.
 */

import { PageHeader } from '@/components/shared/page-header';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { AllExpenses } from '@/components/finance/all-expenses';

export default function AllExpensesPage() {
  return (
    <main className="p-4 sm:p-8">
      <Link
        href="/finance"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg-muted hover:text-primary"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Finance
      </Link>
      <PageHeader title="Expenses" description="Everything you have logged, newest first." />

      <div className="mt-6">
        <AllExpenses />
      </div>
    </main>
  );
}
