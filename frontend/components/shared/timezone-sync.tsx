'use client';

import { useEffect } from 'react';

import { api } from '@/lib/api-client';
import type { Profile } from '@/lib/types/profile';

/** The browser's IANA timezone ("Asia/Singapore"), or null if it will not say. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Keep the profile's timezone where the user actually is, without asking.
 *
 * The browser already works in local time, but the server cannot see the
 * browser: anything it decides on its own — the first charge of a new
 * subscription, and the scheduled renewals and reminders — reads "today" from
 * the profile. Someone who moves to Tokyo for six months should have those
 * land on Tokyo's midnight, not on whatever zone they signed up in.
 *
 * Silent by design: no notice, no prompt. It runs once per page load (the
 * signed-in layout stays mounted across navigation), and any failure is
 * swallowed — a missed sync is retried on the next load, and is never worth
 * an error on a page that is otherwise fine.
 */
export function TimezoneSync() {
  useEffect(() => {
    const local = browserTimezone();
    if (!local) return;

    let cancelled = false;
    void (async () => {
      try {
        const profile = await api.get<Profile>('/auth/me');
        if (!cancelled && profile.timezone !== local) {
          await api.patch<Profile>('/auth/me', { timezone: local });
        }
      } catch {
        // Silent on purpose — see above.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
