import type { Href } from 'expo-router';

import type * as Api from '@/lib/types/api.gen';

/**
 * What a notification is and what can be done about it — the phone's copy of the web's
 * frontend/lib/types/notification.ts. The rules are the same; only the links differ, because the
 * phone's screens live at other paths.
 */

/**
 * What a notification is about. The values are the backend's (api.gen.ts):
 *
 * - `subscription_renewal`, `trial_ending`: reminders, counting down to a charge.
 * - `subscription_renewed`: a renewal was recorded as an expense.
 * - `currency_delisted`: a currency the person uses can no longer be converted.
 * - `budget_warning`: a budget reached its early-warning share of the cap.
 * - `budget_exceeded`: a budget reached its cap.
 */
export type NotificationKind = Api.NotificationKind;

/**
 * NotificationRead from the backend's schema, named as the web names it.
 *
 * - `title`: reminders carry their countdown here, rewritten by the backend each day.
 * - `due_on`: the day the announced thing happens, YYYY-MM-DD; null for undated notices.
 * - `read_at`: null while unread — what the bell counts.
 * - `snoozed_at`: a reminder muted until its charge.
 * - `archived_at`: a notice moved to the history.
 * - `alerted_at`: when it last asked for attention; lists are ordered by it.
 */
export type AppNotification = Api.NotificationRead;

/** The one change a notification takes at a time (PATCH /notifications/{id}), or deleting it. */
export type NotificationChange =
  | { read: boolean }
  | { snoozed: boolean }
  | { archived: true }
  | 'delete';

/**
 * Reminders count down to a charge and leave on their own: they can be snoozed, never archived
 * or deleted. Everything else is a notice, which the person moves to the history and deletes
 * from there.
 */
export function isReminder(notification: AppNotification): boolean {
  return notification.kind === 'subscription_renewal' || notification.kind === 'trial_ending';
}

export interface NotificationLink {
  href: Href;
  label: string;
}

/**
 * Where to go to act on a notification — the web's targets, at the phone's paths: a renewal
 * opens Transactions (the web's expenses), a reminder opens Subscriptions itself rather than
 * Finance's overview, and a dropped currency opens the profile, where the currencies are.
 */
export function linkFor(kind: NotificationKind): NotificationLink {
  switch (kind) {
    case 'currency_delisted':
      return { href: '/more/profile', label: 'Currency settings' };
    case 'subscription_renewed':
      return { href: '/finance/transactions', label: 'View expenses' };
    case 'budget_warning':
    case 'budget_exceeded':
      return { href: '/finance/budgets', label: 'View budgets' };
    default:
      return { href: '/finance/subscriptions', label: 'Manage subscription' };
  }
}

/**
 * The button that moves a notice out of the inbox: "Got it" for news to acknowledge — a dropped
 * currency, a budget nearly or fully spent — and "Move to history" for a record worth keeping, a
 * renewal.
 */
export function archiveLabel(kind: NotificationKind): string {
  return kind === 'subscription_renewed' ? 'Move to history' : 'Got it';
}

/** The bell's badge: the count, capped so it fits the dot — "9+" past nine, as on the web. */
export function badgeText(unread: number): string {
  return unread > 9 ? '9+' : String(unread);
}
