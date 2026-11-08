import type { BillingInterval, Subscription } from '@/lib/finance/types';
import { amountProblem } from '@/lib/money';

/**
 * A subscription as its form holds it, the checks it runs, and what it sends — the phone's
 * copies of the web's subscription-form.tsx rules and words.
 */

export interface SubscriptionValues {
  name: string;
  amount: string;
  currency: string;
  interval_unit: BillingInterval;
  /** As typed, so "1" can be cleared and retyped. */
  interval_count: string;
  /** '' is Uncategorised. */
  category_id: string;
  started_on: string;
  /** '' for no trial. */
  trial_ends_on: string;
  /** '' while it runs; only the edit form shows it. */
  cancelled_on: string;
}

/**
 * Where the form starts: the subscription's own values when editing; otherwise monthly, every 1
 * month, started today, in the person's currency, under the category named Subscriptions if they
 * have one (the caller works that out with `preselectedCategoryId`).
 */
export function subscriptionValues(
  subscription: Subscription | null | undefined,
  defaults: { currency: string; categoryId: string; today: string }
): SubscriptionValues {
  if (subscription) {
    return {
      name: subscription.name,
      amount: subscription.amount,
      currency: subscription.currency,
      interval_unit: subscription.interval_unit,
      interval_count: String(subscription.interval_count),
      category_id: subscription.category_id ?? '',
      started_on: subscription.started_on,
      trial_ends_on: subscription.trial_ends_on ?? '',
      cancelled_on: subscription.cancelled_on ?? '',
    };
  }
  return {
    name: '',
    amount: '',
    currency: defaults.currency,
    interval_unit: 'month',
    interval_count: '1',
    category_id: defaults.categoryId,
    started_on: defaults.today,
    trial_ends_on: '',
    cancelled_on: '',
  };
}

export type SubscriptionProblems = Partial<
  Record<'name' | 'amount' | 'interval_count' | 'trial_ends_on' | 'cancelled_on', string>
>;

/** What is wrong, field by field, in the web's words — checked on submit. */
export function subscriptionProblems(values: SubscriptionValues): SubscriptionProblems {
  const problems: SubscriptionProblems = {};
  if (!values.name.trim()) problems.name = 'Enter a name for the subscription.';
  const amount = amountProblem(values.amount);
  if (amount) problems.amount = amount;
  const count = values.interval_count.trim();
  if (!/^\d+$/.test(count) || Number(count) < 1) {
    problems.interval_count = 'Bill every 1 or more — a whole number.';
  }
  if (values.trial_ends_on && values.trial_ends_on <= values.started_on) {
    problems.trial_ends_on = 'The trial must end after the start date.';
  }
  if (values.cancelled_on && values.cancelled_on < values.started_on) {
    problems.cancelled_on = 'The cancellation date must be on or after the start date.';
  }
  return problems;
}

/**
 * The body POST and PATCH send — the web's: every nullable field explicitly, so an edit can clear
 * a trial or a category; the cancellation only when editing, since a new subscription can't be
 * created cancelled (and an empty one resumes it).
 */
export function subscriptionPayload(values: SubscriptionValues, editing: boolean) {
  return {
    name: values.name.trim(),
    amount: values.amount.trim(),
    currency: values.currency,
    interval_unit: values.interval_unit,
    interval_count: Number(values.interval_count.trim()),
    category_id: values.category_id || null,
    started_on: values.started_on,
    trial_ends_on: values.trial_ends_on || null,
    ...(editing ? { cancelled_on: values.cancelled_on || null } : {}),
  };
}

/** The billing unit's word for the count typed: "Month" for every 1, "Months" otherwise. */
export function unitLabel(unit: BillingInterval, count: string): string {
  const word = unit.charAt(0).toUpperCase() + unit.slice(1);
  return count.trim() === '1' ? word : `${word}s`;
}
