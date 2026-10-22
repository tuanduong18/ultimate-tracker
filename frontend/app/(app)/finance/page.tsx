/**
 * Finance overview: how this month is going, at a glance.
 *
 * Everything below the tabs is client-side and lives in FinanceDashboard,
 * which owns the fetches so the panels stay in step after a write.
 */

import type { Metadata } from 'next';

import { FinanceDashboard } from '@/components/finance/finance-dashboard';

export const metadata: Metadata = { title: 'Finance' };

export default function FinancePage() {
  return <FinanceDashboard />;
}
