import type { Metadata } from 'next';

import { ComingSoon } from '@/components/shared/coming-soon';
import { moduleFor } from '@/components/shared/nav-items';

export const metadata: Metadata = { title: 'Insights' };

export default function InsightsPage() {
  const entry = moduleFor('/insights');
  return entry.status === 'soon' ? <ComingSoon module={entry} /> : null;
}
