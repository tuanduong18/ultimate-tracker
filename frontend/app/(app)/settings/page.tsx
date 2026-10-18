/**
 * Preferences that belong to the app rather than to the person.
 *
 * The display currency lives on /profile instead, because it is stored against
 * the profile and travels with the account. What is here is per-device.
 */

import { PageHeader } from '@/components/shared/page-header';
import { ThemePicker } from '@/components/settings/theme-picker';

export default function SettingsPage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader title="Settings" description="How the app looks on this device." />

      <div className="mt-8 max-w-3xl">
        <ThemePicker />
      </div>
    </main>
  );
}
