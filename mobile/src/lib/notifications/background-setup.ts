import * as BackgroundTask from 'expo-background-task';
import { Linking, Platform } from 'react-native';

/**
 * Whether this phone needs the background setup (more/background-setup.tsx): Xiaomi's HyperOS
 * stops background work for any app it hasn't been told to leave alone, which on the reference
 * phone means syncs that never run. Offered on Xiaomi phones (Redmi and POCO are Xiaomi's), and
 * on any phone where Android itself reports background work restricted.
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
