import type { IconName } from '@/components/icon';
import type { NotificationKind } from '@/lib/notifications/notifications';
import type * as Api from '@/lib/types/api.gen';

/**
 * Notification categories — what a person turns off — in the words both places use: the app's
 * Settings (the switches) and Android's own notification settings (one channel per category,
 * same id, same name). docs/features/platform.md § Notification categories.
 *
 * The ids the switches may send come from the API's own type, so the three that can be muted are
 * written down once, by the backend; only currency notices, which can't be, is named here.
 */
export type MutableCategory = Api.ProfileRead['muted_notifications'][number];
export type Category = MutableCategory | 'currency_notices';

/**
 * The backend's CATEGORY_OF (backend/app/models/notification.py). Typed over every kind, so a
 * kind the backend adds fails `tsc` here until it is placed.
 */
export const CATEGORY_OF: Record<NotificationKind, Category> = {
  subscription_renewal: 'subscription_reminders',
  trial_ending: 'subscription_reminders',
  subscription_renewed: 'subscription_renewals',
  budget_warning: 'budget_alerts',
  budget_exceeded: 'budget_alerts',
  currency_delisted: 'currency_notices',
};

export interface CategoryInfo {
  id: Category;
  /** The switch's label and the Android channel's name. */
  label: string;
  /** One line: what it covers. Also the channel's description in Android's settings. */
  description: string;
  icon: IconName;
}

/** The three with a switch; currency notices can't be turned off. */
export function isMutable(
  category: CategoryInfo
): category is CategoryInfo & { id: MutableCategory } {
  return category.id !== 'currency_notices';
}

/** In the spec's order, which is the order of the switches and of the channels. */
export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'subscription_reminders',
    label: 'Subscription reminders',
    description: 'A countdown before each renewal and before a trial ends.',
    icon: 'notifications_active',
  },
  {
    id: 'subscription_renewals',
    label: 'Renewals',
    description: 'A receipt when a subscription renews and is logged as an expense.',
    icon: 'receipt_long',
  },
  {
    id: 'budget_alerts',
    label: 'Budget alerts',
    description: 'When a budget reaches its early warning or its cap.',
    icon: 'speed',
  },
  {
    id: 'currency_notices',
    label: 'Currency notices',
    description: 'When a currency you use can no longer be converted. Always on.',
    icon: 'currency_exchange',
  },
];
