import type * as Api from '@/lib/types/api.gen';

/**
 * Notification categories — what a person turns off — in the words both clients use: the twin of
 * the Android app's lib/notifications/categories.ts, where the same ids are also the phone's
 * notification channels. docs/features/platform.md § Notification categories.
 *
 * The ids come from the API's own type, so a category the backend adds or renames fails the type
 * check here until it has its words. Currency notices have no entry: they can't be turned off.
 */
export type MutableCategory = Api.ProfileRead['muted_notifications'][number];

const WORDS: Record<MutableCategory, { label: string; description: string }> = {
  subscription_reminders: {
    label: 'Subscription reminders',
    description: 'A countdown before each renewal and before a trial ends.',
  },
  subscription_renewals: {
    label: 'Renewals',
    description: 'A receipt when a subscription renews and is logged as an expense.',
  },
  budget_alerts: {
    label: 'Budget alerts',
    description: 'When a budget reaches its early warning or its cap.',
  },
};

/** In the spec's order, which is the order of the switches on both clients. */
export const MUTABLE_CATEGORIES = (Object.keys(WORDS) as MutableCategory[]).map((id) => ({
  id,
  ...WORDS[id],
}));

/** Why the fourth category has no switch. */
export const CURRENCY_NOTICES_NOTE =
  'Currency notices always arrive: a currency that can no longer be converted needs you to act.';
