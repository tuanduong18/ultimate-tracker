import { ComingSoon } from '@/components/shared/coming-soon';
import { moduleFor } from '@/components/shared/nav-items';

export default function TimePage() {
  const entry = moduleFor('/time');
  return entry.status === 'soon' ? <ComingSoon module={entry} /> : null;
}
