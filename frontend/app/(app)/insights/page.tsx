import { ComingSoon } from '@/components/shared/coming-soon';
import { moduleFor } from '@/components/shared/nav-items';

export default function InsightsPage() {
  const entry = moduleFor('/insights');
  return entry.status === 'soon' ? <ComingSoon module={entry} /> : null;
}
