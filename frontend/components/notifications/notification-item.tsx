'use client';

import clsx from 'clsx';
import { BellOff, BellRing, Coins, Gauge, Receipt, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { api } from '@/lib/api-client';
import { describeError } from '@/lib/hooks/use-collection';
import {
  announceNotificationsChange,
  archiveLabel,
  isReminder,
  linkFor,
  type AppNotification,
} from '@/lib/types/notification';

type Change = { snoozed: boolean } | { archived: true } | 'delete';

const ICONS = {
  subscription_renewal: BellRing,
  trial_ending: BellRing,
  subscription_renewed: Receipt,
  currency_delisted: Coins,
  budget_warning: Gauge,
  budget_exceeded: TriangleAlert,
} as const;

/**
 * One notification, with what can be done about it where it is shown.
 *
 * In the inbox: a reminder can be snoozed ("I'm renewing anyway"), a notice
 * moved to the history. In the history: a snoozed reminder can be unsnoozed,
 * in case it was pressed by mistake, and a notice deleted. Each also links to
 * where it can be acted on — the subscription, the expenses, the budgets, the
 * settings.
 *
 * Every action goes to the server and then reloads, rather than updating in
 * place, so what is shown is what was stored.
 */
export function NotificationItem({
  notification,
  fresh = false,
  onChanged,
  onNavigate,
}: {
  notification: AppNotification;
  /** Unread when the list was opened — drawn with a dot. */
  fresh?: boolean;
  onChanged: () => Promise<void> | void;
  /** Called when its link is followed, so a popover can close. */
  onNavigate?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reminder = isReminder(notification);
  const snoozed = notification.snoozed_at !== null;
  const archived = notification.archived_at !== null;
  const link = linkFor(notification.kind);
  const Icon = snoozed ? BellOff : ICONS[notification.kind];

  async function change(what: Change) {
    setBusy(true);
    setError(null);
    try {
      const path = `/notifications/${notification.id}`;
      if (what === 'delete') await api.delete(path);
      else await api.patch<AppNotification>(path, what);
      announceNotificationsChange();
      await onChanged();
    } catch (err: unknown) {
      setError(describeError(err, 'Could not update this notification.'));
    } finally {
      setBusy(false);
    }
  }

  const primary = 'min-h-9 rounded-md px-3 text-sm font-medium disabled:opacity-50';
  const secondary = 'min-h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50';

  return (
    <article
      // Snoozed and archived say so in words; the row is not faded, because
      // fading it fades its text below a readable contrast.
      className="flex gap-3 px-4 py-3"
      aria-label={notification.title}
    >
      <span
        aria-hidden
        className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft"
      >
        <Icon className="size-4 text-fg" />
        {fresh && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{notification.title}</h3>
        <p className="mt-0.5 text-sm text-fg-muted">{notification.body}</p>
        {snoozed && (
          <p className="mt-1.5 text-xs text-fg-muted">
            Snoozed — it won’t come back unless you edit the subscription.
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {reminder && !snoozed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void change({ snoozed: true })}
              className={clsx(primary, 'bg-primary text-primary-fg hover:opacity-90')}
            >
              Snooze
            </button>
          )}
          {reminder && snoozed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void change({ snoozed: false })}
              className={clsx(secondary, 'hover:bg-primary-soft')}
            >
              Unsnooze
            </button>
          )}
          {!reminder && !archived && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void change({ archived: true })}
              className={clsx(primary, 'bg-primary text-primary-fg hover:opacity-90')}
            >
              {archiveLabel(notification.kind)}
            </button>
          )}
          {!reminder && archived && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void change('delete')}
              className={clsx(secondary, 'text-negative hover:bg-negative-soft')}
            >
              Delete
            </button>
          )}
          <Link
            href={link.href}
            onClick={onNavigate}
            className="flex min-h-9 items-center rounded-md px-2 text-sm underline-offset-2 hover:underline"
          >
            {link.label}
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
