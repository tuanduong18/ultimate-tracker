import type { Metadata } from 'next';

import { ComingSoon } from '@/components/shared/coming-soon';
import { moduleFor } from '@/components/shared/nav-items';

export const metadata: Metadata = { title: 'Gaming' };

export default function GamingPage() {
  const entry = moduleFor('/gaming');
  return entry.status === 'soon' ? <ComingSoon module={entry} /> : null;
}
