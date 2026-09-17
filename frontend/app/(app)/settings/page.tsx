/**
 * Preferences that belong to the app rather than to the person.
 *
 * The display currency lives on /profile instead, because it is stored against
 * the profile and travels with the account. What is here is per-device.
 */

import { ThemePicker } from '@/components/settings/theme-picker';

export default function SettingsPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-fg-muted">How the app looks on this device.</p>

      <div className="mt-8 max-w-3xl">
        <ThemePicker />
      </div>
    </main>
  );
}
