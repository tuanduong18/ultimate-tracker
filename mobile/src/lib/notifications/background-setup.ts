import * as BackgroundTask from 'expo-background-task';
import { Linking, Platform } from 'react-native';

import type { IconName } from '@/components/icon';

/**
 * Whether this phone needs the background setup (more/background-setup.tsx): Xiaomi's HyperOS
 * stops background work for any app it hasn't been told to leave alone, which on the reference
 * phone means syncs that never run. Offered on Xiaomi phones (Redmi and POCO are Xiaomi's), and
 * on any phone where Android itself reports background work restricted. Anywhere else it stays
 * out of sight unless the sync falls behind (more/notification-settings.tsx).
 *
 * Whether Autostart is on can't be read by an app, so the setup screen explains and
 * "Last synced" shows whether it worked.
 */
export function isXiaomi(constants: { Brand?: string; Manufacturer?: string }): boolean {
  const names = [constants.Brand, constants.Manufacturer].map((name) => name?.toLowerCase() ?? '');
  return names.some((name) => ['xiaomi', 'redmi', 'poco'].includes(name));
}

export function thisPhoneIsXiaomi(): boolean {
  return isXiaomi(Platform.constants as { Brand?: string; Manufacturer?: string });
}

export async function needsBackgroundSetup(): Promise<boolean> {
  if (thisPhoneIsXiaomi()) return true;
  try {
    return (
      (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted
    );
  } catch {
    return false;
  }
}

export interface SetupStep {
  icon: IconName;
  /** What to set, in the words the phone's own settings use. */
  title: string;
  /** Why. */
  body: string;
}

export interface SetupGuide {
  intro: string;
  steps: SetupStep[];
  /** What to avoid, where the phone makes it easy to do by accident. */
  avoid: string;
}

const REMINDERS_EITHER_WAY =
  'Reminders ring on time either way; this is for budget alerts and other notices while the app is closed.';

/**
 * What to set, for this phone. Only Xiaomi's HyperOS has Autostart and calls its battery
 * setting "Battery saver"; other phones on Android 14, Samsung's included, keep one battery
 * setting on the app's page, called "Unrestricted". A guide naming a switch the phone hasn't got
 * is worse than none, so the words follow the phone.
 */
export function setupGuide(xiaomi: boolean): SetupGuide {
  if (xiaomi) {
    return {
      intro: `HyperOS stops apps working in the background unless they are allowed to. Without these two settings, notices reach this phone only when you open the app. ${REMINDERS_EITHER_WAY}`,
      steps: [
        {
          icon: 'power_settings_new',
          title: 'Autostart: on',
          body: 'Lets the app start itself to sync, and to set its reminders again after a restart.',
        },
        {
          icon: 'battery_saver',
          title: 'Battery saver: No restrictions',
          body: 'Stops the phone pausing the hourly sync to save battery.',
        },
      ],
      avoid:
        'Android then cancels its reminders until you open the app again. Clearing recent apps can count as a force stop on this phone.',
    };
  }
  return {
    intro: `This phone is limiting what the app can do in the background, so notices reach it only when you open the app. ${REMINDERS_EITHER_WAY}`,
    steps: [
      {
        icon: 'battery_saver',
        title: 'Battery: Unrestricted',
        body: 'Lets the hourly sync run while the app is closed.',
      },
    ],
    avoid: 'Android then cancels its reminders until you open the app again.',
  };
}

const APP_PACKAGE = 'android.provider.extra.APP_PACKAGE';

/**
 * Android's own pages, opened from Settings. A page the phone doesn't have falls back to the
 * app's page in Android's settings, which every phone has (HyperOS keeps Autostart, Battery saver
 * and Notifications there).
 */
export async function openAppNotificationSettings(appPackage: string): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: APP_PACKAGE, value: appPackage },
    ]);
  } catch {
    await Linking.openSettings();
  }
}

export async function openChannelSettings(appPackage: string, channelId: string): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: APP_PACKAGE, value: appPackage },
      { key: 'android.provider.extra.CHANNEL_ID', value: channelId },
    ]);
  } catch {
    await Linking.openSettings();
  }
}
