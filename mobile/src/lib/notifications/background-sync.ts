import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { syncTray } from '@/lib/notifications/sync';

/**
 * The hourly background sync: WorkManager, through expo-background-task, runs the tray sync with
 * the app closed, so a notice the server wrote reaches the tray within about an hour.
 *
 * - Defined at the top level and imported by the app's entry (`index.ts`): Android may start the
 *   app with no screen just to run it, and the definition must already exist.
 * - 60 minutes is asked for because the library's default is 12 hours. Android treats it as a
 *   minimum, runs it only with a connection and enough battery, and not at all once the app has
 *   been killed — which HyperOS does without Autostart (more/background-setup.tsx).
 * - Every call it makes is safe to repeat, so a late or doubled run only catches up.
 */
export const TRAY_TASK = 'tray-sync';
export const TRAY_INTERVAL_MINUTES = 60;

TaskManager.defineTask(TRAY_TASK, async () => {
  try {
    const result = await syncTray({ appOpen: false });
    return result === 'failed'
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registered once a person is signed in; a registered task survives updates and restarts. */
export async function registerTraySync(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TRAY_TASK)) return;
  await BackgroundTask.registerTaskAsync(TRAY_TASK, { minimumInterval: TRAY_INTERVAL_MINUTES });
}
