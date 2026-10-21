import { PageHeader } from '@/components/shared/page-header';
import { ProfileSettings } from '@/components/profile/profile-settings';

export default function ProfilePage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title="Profile" description="Your account and your preferences." />

      <ProfileSettings />
    </main>
  );
}
