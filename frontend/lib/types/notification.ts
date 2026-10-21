/**
 * Mirrors NotificationRead in backend/app/schemas/notification.py.
 *
 * Named AppNotification because the browser already owns `Notification` (the
 * Web Notifications API), and shadowing it invites the wrong import.
 */
export type NotificationKind =
  'subscription_renewal' | 'trial_ending' | 'subscription_renewed' | 'currency_delisted';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Reminders carry their countdown here, rewritten by the backend each day. */
  title: string;
  body: string;
  /** The day the announced thing happens, YYYY-MM-DD; null for undated notices. */
  due_on: string | null;
  read_at: string | null;
  /** A reminder muted until its charge. */
  snoozed_at: string | null;
  /** A notice moved to the history. */
  archived_at: string | null;
  /** When it last asked for attention; lists are ordered by it. */
  alerted_at: string;
  created_at: string;
}

/** Fired after any change, so the bell and the notifications page agree. */
export const NOTIFICATIONS_CHANGED = 'notifications:changed';

export function announceNotificationsChange(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

/**
 * Reminders count down to a charge and leave on their own: they can be
 * snoozed, never archived or deleted. Everything else is a notice, which the
 * user moves to the history and deletes from there.
 */
export function isReminder(notification: AppNotification): boolean {
  return notification.kind === 'subscription_renewal' || notification.kind === 'trial_ending';
}

export interface NotificationLink {
  href: string;
  label: string;
}

/** Where to go to act on a notification. */
export function linkFor(kind: NotificationKind): NotificationLink {
  switch (kind) {
    case 'currency_delisted':
      return { href: '/profile', label: 'Currency settings' };
    case 'subscription_renewed':
      return { href: '/finance/expenses', label: 'View expenses' };
    default:
      return { href: '/finance', label: 'Manage subscription' };
  }
}

/** The button that moves a notice out of the inbox. */
export function archiveLabel(kind: NotificationKind): string {
  return kind === 'currency_delisted' ? 'Got it' : 'Move to history';
}
