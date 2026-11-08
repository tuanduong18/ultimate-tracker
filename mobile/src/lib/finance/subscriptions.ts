import { daysUntil, formatDate } from '@/lib/dates';
import type { BillingInterval, Subscription } from '@/lib/finance/types';

/**
 * How a subscription's billing is described — the phone's copies of the helpers in the web's
 * subscription-section.tsx and summary-tiles.tsx, with the same words.
 */

/** Days ahead a renewal counts as soon — the same lead the reminder notification uses. */
export const REMINDER_DAYS = 3;

/** "month" or "3 months" — how often it bills, for "/ month" and "every 3 months". */
export function formatInterval(unit: BillingInterval, count: number): string {
  return count === 1 ? unit : `${count} ${unit}s`;
}

/** "today", "tomorrow", "in 5 days" — anything already past counts as today. */
export function inDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * The row's line about what happens next, and whether it is soon enough to stand out (said in
 * words and marked by an icon, never by colour alone).
 */
export function nextStep(
  subscription: Subscription,
  today: string
): { text: string; soon: boolean } {
  const { cancelled_on, next_billing_on, trial_ends_on } = subscription;
  if (cancelled_on && cancelled_on <= today) {
    return { text: `Cancelled ${formatDate(cancelled_on)}`, soon: false };
  }

  // The first charge is the end of the trial, so while that is still ahead the next charge *is*
  // the trial ending.
  const trial = trial_ends_on !== null && trial_ends_on === next_billing_on;
  const verb = trial ? 'Trial ends' : 'Renews';
  const days = daysUntil(next_billing_on, today);
  const ending = cancelled_on ? ` · ends ${formatDate(cancelled_on)}` : '';

  if (days < 0) {
    // Nothing has advanced the date yet — the renewal job is what does that.
    return { text: `Was due ${formatDate(next_billing_on)}${ending}`, soon: false };
  }
  if (days <= REMINDER_DAYS) {
    return { text: `${verb} ${inDays(days)}${ending}`, soon: true };
  }
  return { text: `${verb} ${formatDate(next_billing_on)}${ending}`, soon: false };
}

/**
 * Whether renewing early can work: not when a cancellation stops the next charge, which the API
 * would refuse with SUBSCRIPTION_CANCELLED. Hidden rather than offered and refused.
 */
export function renewable({ cancelled_on, next_billing_on }: Subscription): boolean {
  return cancelled_on === null || cancelled_on > next_billing_on;
}

/** Still charging: never cancelled, or cancelled from a day still ahead. */
export function isLive(subscription: Subscription, today: string): boolean {
  return subscription.cancelled_on === null || subscription.cancelled_on > today;
}

/** Ended: cancelled from today or earlier — drawn quieter, at the end of the list. */
export function hasEnded(subscription: Subscription, today: string): boolean {
  return !isLive(subscription, today);
}
