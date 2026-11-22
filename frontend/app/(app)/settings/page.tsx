/**
 * Preferences: how the app looks, then which notifications the account gets.
 *
 * The look is per-device, remembered in the browser. The notification switches
 * are stored against the profile and hold on every device, which the section
 * says for itself. The display currency lives on /profile with the rest of the
 * account's details.
 */

import type { Metadata } from 'next';

import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { PageHeader } from '@/components/shared/page-header';
import { ThemePicker } from '@/components/settings/theme-picker';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <main className="p-4 sm:p-8">
      <PageHeader
        title="Settings"
        description="How the app looks, and what it notifies you about."
      />

      <div className="mt-8 max-w-3xl space-y-8">
        <ThemePicker />
        <NotificationPreferences />
      </div>
    </main>
  );
}
