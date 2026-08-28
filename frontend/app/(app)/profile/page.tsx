import { DisplayCurrencyForm } from '@/components/profile/display-currency-form';

export default function ProfilePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-gray-500">Account details and preferences.</p>

      <DisplayCurrencyForm />
    </main>
  );
}
