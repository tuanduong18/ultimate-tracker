/**
 * Personal budgeting.
 *
 * Everything below the heading is client-side and lives in FinanceDashboard,
 * which owns the fetches so the sections stay in step after a write.
 */

import { FinanceDashboard } from '@/components/finance/finance-dashboard';
import { PageHeader } from '@/components/shared/page-header';

export default function FinancePage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title="Finance" description="Track what you spend against what you planned." />

      <FinanceDashboard />
    </main>
  );
}
