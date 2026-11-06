import * as Localization from 'expo-localization';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api-client';
import type { Profile } from '@/lib/types/profile';

/** The phone's IANA timezone ("Asia/Singapore"), or null if it will not say. */
export function deviceTimezone(): string | null {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

/** Set the profile's timezone to `local` if it differs. Returns whether it had to change. */
export async function syncTimezone(local: string): Promise<boolean> {
  const profile = await api.get<Profile>('/auth/me');
  if (profile.timezone === local) return false;
  await api.patch<Profile>('/auth/me', { timezone: local });
  return true;
}

/**
 * Keep the profile's timezone where the phone is, without asking — the twin of the web's
 * TimezoneSync. The server decides "today" from the profile (first charges, renewals,
 * reminders), so someone who flies to Tokyo should have those land on Tokyo's midnight.
 *
 * The phone is the device that travels, so this goes one step further than the web: it checks
 * again whenever the app comes back to the front, and calls the API only when the phone's zone
 * differs from the one last synced. Silent by design — a failure is retried on the next check
 * and is never worth an error on a screen that is otherwise fine.
 */
export function useTimezoneSync(): void {
  useEffect(() => {
    let synced: string | null = null;

    const check = () => {
      const local = deviceTimezone();
      if (!local || local === synced) return;
      syncTimezone(local)
        .then(() => {
          synced = local;
        })
        .catch(() => {
          // Silent on purpose — see above.
        });
    };

    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, []);
}
