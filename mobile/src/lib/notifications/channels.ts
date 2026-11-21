import * as Notifications from 'expo-notifications';

import { CATEGORIES, type Category } from '@/lib/notifications/categories';

/**
 * Android's notification channels: one per category, in a group per module, created before
 * anything is scheduled. docs/features/platform.md § Phone notifications, "Channels".
 *
 * - **The set is fixed here.** A channel or group not in it is deleted — one left by an older
 *   build, or the library's own "Miscellaneous" — so Android's settings list exactly these.
 * - **A channel's settings belong to the person once it exists.** Re-creating it can change its
 *   name and description only; its importance below applies to a channel being created. An id
 *   therefore never changes: a new sound or importance would need a new id.
 * - Ids are the category ids the switches use, so "off" means the same thing in both places.
 */
const FINANCE = 'finance';

const IMPORTANCE: Record<Category, Notifications.AndroidImportance> = {
  // Default: a sound, no pop-up.
  subscription_reminders: Notifications.AndroidImportance.DEFAULT,
  // Low: silent, in the shade — a receipt.
  subscription_renewals: Notifications.AndroidImportance.LOW,
  budget_alerts: Notifications.AndroidImportance.DEFAULT,
  currency_notices: Notifications.AndroidImportance.DEFAULT,
};

/** Finance's group; later modules bring theirs with their first channel. */
const GROUP_OF: Record<Category, string> = {
  subscription_reminders: FINANCE,
  subscription_renewals: FINANCE,
  budget_alerts: FINANCE,
  currency_notices: FINANCE,
};

const GROUP_NAMES: Record<string, string> = { [FINANCE]: 'Finance' };

export async function ensureChannels(): Promise<void> {
  for (const [id, name] of Object.entries(GROUP_NAMES)) {
    await Notifications.setNotificationChannelGroupAsync(id, { name });
  }
  for (const category of CATEGORIES) {
    await Notifications.setNotificationChannelAsync(category.id, {
      name: category.label,
      description: category.description,
      importance: IMPORTANCE[category.id],
      groupId: GROUP_OF[category.id],
    });
  }

  const wanted = new Set<string>(CATEGORIES.map((category) => category.id));
  for (const channel of await Notifications.getNotificationChannelsAsync()) {
    if (!wanted.has(channel.id)) await Notifications.deleteNotificationChannelAsync(channel.id);
  }
  for (const group of await Notifications.getNotificationChannelGroupsAsync()) {
    if (!(group.id in GROUP_NAMES))
      await Notifications.deleteNotificationChannelGroupAsync(group.id);
  }
}

/** Whether Android lets each channel notify: "Off" when the person turned it off there. */
export async function channelsOn(): Promise<Record<string, boolean>> {
  const on: Record<string, boolean> = {};
  for (const channel of await Notifications.getNotificationChannelsAsync()) {
    on[channel.id] = channel.importance !== Notifications.AndroidImportance.NONE;
  }
  return on;
}
