'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { NotificationItem } from '@/components/notifications/notification-item';
import { api } from '@/lib/api-client';
import { useCollection } from '@/lib/hooks/use-collection';
import { useNotificationUpdates } from '@/lib/hooks/use-notification-updates';
import { announceNotificationsChange, type AppNotification } from '@/lib/types/notification';

/**
 * The bell top right: a count of unread notifications in the inbox, and a
 * panel listing the inbox with each one's actions.
 *
 * Opening the panel marks what it shows as read, which clears the count; the
 * ones that were unread keep a dot until the panel closes, so it still shows
 * what is new. Read is not done — a reminder stays until its charge or until
 * it is snoozed, and a notice until it is moved to the history. A reminder's
 * daily countdown comes back unread, so the count returns each day.
 *
 * Kept live by useNotificationUpdates (Supabase Realtime, with refetches on
 * focus and on a slow poll as a safety net).
 *
 * Built as a disclosure like the account menu, with the same Escape and
 * click-outside behaviour.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const inbox = useCollection<AppNotification>('/notifications');
  const { items, reload } = inbox;
  const unread = items.filter((n) => n.read_at === null);

  useNotificationUpdates(() => void reload());

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function markRead(ids: string[]) {
    try {
      await Promise.all(ids.map((id) => api.patch(`/notifications/${id}`, { read: true })));
    } finally {
      // Partial failures included: show what the server now holds.
      announceNotificationsChange();
    }
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const ids = unread.map((n) => n.id);
    setFresh(new Set(ids));
    setOpen(true);
    if (ids.length > 0) void markRead(ids);
  }

  const count = unread.length;
  const label = count > 0 ? `Notifications, ${count} new` : 'Notifications';

  return (
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={toggle}
        className="relative flex size-11 items-center justify-center rounded-full hover:bg-primary-soft"
      >
        <Bell aria-hidden className="size-5" />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-4.5 font-semibold text-primary-fg"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-2 top-16 z-40 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </header>

          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {inbox.error && (
              <p role="alert" className="px-4 py-3 text-sm text-negative">
                {inbox.error}
              </p>
            )}
            {!inbox.error && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-fg-muted">
                {inbox.loading ? 'Loading…' : 'You’re all caught up.'}
              </p>
            )}
            {items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                fresh={fresh.has(notification.id)}
                onChanged={reload}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
