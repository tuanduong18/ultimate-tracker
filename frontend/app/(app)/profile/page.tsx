import { PageHeader } from '@/components/shared/page-header';
import { DisplayCurrencyForm } from '@/components/profile/display-currency-form';

export default function ProfilePage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title="Profile" description="Account details and preferences." />

      <DisplayCurrencyForm />
    </main>
  );
}
