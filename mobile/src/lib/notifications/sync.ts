import * as Notifications from 'expo-notifications';

import { api } from '@/lib/api-client';
import { ensureChannels } from '@/lib/notifications/channels';
import type { AppNotification } from '@/lib/notifications/notifications';
import { INBOX_PATH } from '@/lib/notifications/queries';
import { forgetMarks, loadMarks, recordSync, saveMarks } from '@/lib/notifications/tray-store';
import { planTray, type TrayEntry } from '@/lib/notifications/tray-plan';
import { supabase } from '@/lib/supabase';

/**
 * The tray sync: load what it needs, ask `planTray` what to do, do it, remember the marks. Every
 * decision is in tray-plan.ts; this file only talks to Android and to storage.
 *
 * Runs at launch and whenever the inbox reloads while the app is open (lib/notifications/
 * tray-hooks.ts: Realtime, coming back to the front, a save, a pull to refresh), and on every
 * background run (background-sync.ts), which loads the inbox itself.
 */
export type SyncResult = 'synced' | 'signed-out' | 'failed';

export interface SyncOptions {
  /** The inbox already loaded by the bell's query; fetched here when absent. */
  inbox?: readonly AppNotification[];
  /** In front: new rows go to the bell, not the tray. */
  appOpen: boolean;
}

// One sync at a time: a launch, a reload and a background run can land together, and two
// rebuilds interleaving would cancel each other's work. The next waits for the one before.
let queue: Promise<unknown> = Promise.resolve();

export function syncTray(options: SyncOptions): Promise<SyncResult> {
  const next = queue.then(() => run(options));
  queue = next.catch(() => undefined);
  return next;
}

async function run({ inbox, appOpen }: SyncOptions): Promise<SyncResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // Signed out, or a session expired past refreshing: nothing to sync, and nothing recorded.
  if (!session) return 'signed-out';

  let rows: readonly AppNotification[];
  try {
    rows = inbox ?? (await api.get<AppNotification[]>(INBOX_PATH));
  } catch {
    // No inbox, no rebuild: what was scheduled stays as it was, and still fires.
    await recordSync(false);
    return 'failed';
  }

  await ensureChannels();
  const [scheduled, presented, marks] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    Notifications.getPresentedNotificationsAsync(),
    loadMarks(session.user.id),
  ]);

  const plan = planTray({
    inbox: rows,
    now: new Date(),
    scheduled: scheduled.map((request) => request.identifier),
    presented: presented.map(({ request }) => ({
      id: request.identifier,
      title: request.content.title ?? '',
      body: request.content.body ?? '',
    })),
    marks,
    appOpen,
  });

  // Each step on its own: one id Android refuses must not stop the rest.
  await Promise.allSettled([
    ...plan.cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    ...plan.dismiss.map((id) => Notifications.dismissNotificationAsync(id)),
  ]);
  await Promise.allSettled([
    ...plan.schedule.map((item) =>
      Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: content(item, false),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.at,
          channelId: item.channel,
        },
      })
    ),
    ...plan.show.map((item) =>
      Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: content(item, item.silent),
        trigger: { channelId: item.channel },
      })
    ),
  ]);

  await saveMarks(session.user.id, plan.marks);
  await recordSync(true);
  return 'synced';
}

/**
 * What one notification says and carries. The row and its kind ride along for a tap: they say
 * where to go and which row to mark read (tray-hooks.ts).
 *
 * `silent`: new words in place of an entry already in the tray. With no sound and no vibration
 * in the content, the library posts it silent whatever the channel's sound
 * (ExpoNotificationBuilder in expo-notifications 58.1.9), so an edit never rings twice.
 */
function content(item: TrayEntry, silent: boolean): Notifications.NotificationContentInput {
  return {
    title: item.title,
    body: item.body,
    data: { rowId: item.rowId, kind: item.kind },
    ...(silent ? { sound: false } : {}),
  };
}

/**
 * Logging out: cancel everything scheduled from the server's rows, clear them from the tray, and
 * forget what was shown, so the next person on this phone never gets the last one's reminders.
 * Anything else the app schedules is left alone.
 */
export async function clearTray(): Promise<void> {
  const [scheduled, presented] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    Notifications.getPresentedNotificationsAsync(),
  ]);
  await Promise.allSettled([
    ...scheduled
      .filter((request) => isTrayId(request.identifier))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    ...presented
      .filter(({ request }) => isTrayId(request.identifier))
      .map(({ request }) => Notifications.dismissNotificationAsync(request.identifier)),
  ]);
  await forgetMarks();
}

function isTrayId(id: string): boolean {
  return id.startsWith('notification:') || id.startsWith('reminder:');
}
