import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = { title: 'Onboarding' };

export default function OnboardingPage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title="Onboarding" description="Coming soon." />
    </main>
  );
}
