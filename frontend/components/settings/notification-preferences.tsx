'use client';

import { BellRing, Gauge, Receipt, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { SwitchTrack } from '@/components/shared/switch-track';
import { api } from '@/lib/api-client';
import { describeError, useResource } from '@/lib/hooks/use-collection';
import {
  CURRENCY_NOTICES_NOTE,
  MUTABLE_CATEGORIES,
  type MutableCategory,
} from '@/lib/notification-categories';
import type { Profile } from '@/lib/types/profile';

/** The icons the notifications themselves carry, so a switch looks like what it silences. */
const ICONS: Record<MutableCategory, LucideIcon> = {
  subscription_reminders: BellRing,
  subscription_renewals: Receipt,
  budget_alerts: Gauge,
};

/**
 * Which notifications the account gets: one switch per category, on everywhere or off everywhere
 * — the bell here, and the Android app's bell and tray.
 *
 * - **A switch, not a checkbox with Save.** Like the colour scheme above it, a switch applies the
 *   moment it is flipped; there is nothing to review before saving one yes-or-no.
 * - **It flips at once and flips back if the save fails**, saying so beside the switches. This is
 *   the one place the app shows a change before the server confirms it: a switch that sat still
 *   for a second after a click would read as broken, and the failure case is spelled out rather
 *   than silent. The stored answer is still what shows once the save has answered.
 * - **One save at a time.** The API takes the whole list, so a second flip waits for the first;
 *   the others are `aria-disabled` rather than `disabled`, which would drop keyboard focus.
 * - Currency notices have no switch, and the last line says why rather than leaving a gap.
 */
export function NotificationPreferences() {
  const profile = useResource<Profile>('/auth/me');
  const [pending, setPending] = useState<{ id: MutableCategory; on: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const muted = profile.data?.muted_notifications ?? [];

  async function flip(id: MutableCategory, label: string, on: boolean) {
    if (pending) return;
    setPending({ id, on });
    setProblem(null);
    try {
      await api.patch<Profile>('/auth/me', {
        muted_notifications: on ? muted.filter((other) => other !== id) : [...muted, id],
      });
      await profile.reload();
    } catch (err: unknown) {
      const why = describeError(err, 'Could not save that.');
      setProblem(`${why} ${label} is still ${on ? 'off' : 'on'}.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">Notifications</legend>
      <p className="mt-1 text-sm text-fg-muted">
        These apply on every device: turn one off and it stops here and in the Android app.
      </p>

      {profile.loading ? (
        <p className="mt-4 text-sm text-fg-muted">Loading…</p>
      ) : !profile.data ? (
        <p role="alert" className="mt-4 text-sm text-negative">
          {profile.error ?? 'Could not load your notification settings.'}
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {MUTABLE_CATEGORIES.map(({ id, label, description }) => {
              const Icon = ICONS[id];
              const on = pending?.id === id ? pending.on : !muted.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-disabled={pending !== null}
                    aria-labelledby={`${id}-label`}
                    aria-describedby={`${id}-description`}
                    onClick={() => void flip(id, label, !on)}
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted aria-disabled:cursor-progress"
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" />
                    <span className="min-w-0 flex-1">
                      <span id={`${id}-label`} className="block text-sm font-medium">
                        {label}
                      </span>
                      <span id={`${id}-description`} className="block text-sm text-fg-muted">
                        {description}
                      </span>
                    </span>
                    <SwitchTrack on={on} />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* The outcome sits with what caused it; nothing is said when a save simply works. */}
          {pending && (
            <p role="status" className="mt-3 text-sm text-fg-muted">
              Saving…
            </p>
          )}
          {problem && (
            <p role="alert" className="mt-3 text-sm text-negative">
              {problem}
            </p>
          )}
          <p className="mt-3 text-sm text-fg-muted">{CURRENCY_NOTICES_NOTE}</p>
        </>
      )}
    </fieldset>
  );
}
