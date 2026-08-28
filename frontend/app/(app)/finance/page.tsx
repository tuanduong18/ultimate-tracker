/**
 * Personal budgeting.
 *
 * Everything below the heading is client-side and lives in FinanceDashboard,
 * which owns the fetches so the sections stay in step after a write.
 */

import { FinanceDashboard } from '@/components/finance/finance-dashboard';

export default function FinancePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <p className="mt-2 text-sm text-gray-500">Track what you spend against what you planned.</p>

      <FinanceDashboard />
    </main>
  );
}
