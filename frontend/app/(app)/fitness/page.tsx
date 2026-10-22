import type { Metadata } from 'next';

import { ComingSoon } from '@/components/shared/coming-soon';
import { moduleFor } from '@/components/shared/nav-items';

export const metadata: Metadata = { title: 'Fitness' };

export default function FitnessPage() {
  const entry = moduleFor('/fitness');
  return entry.status === 'soon' ? <ComingSoon module={entry} /> : null;
}
