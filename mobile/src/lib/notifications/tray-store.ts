import * as SecureStore from 'expo-secure-store';

import type { TrayMarks } from '@/lib/notifications/tray-plan';

/**
 * What the phone remembers for its notifications, between launches and background runs. Small
 * values in SecureStore, like the look (theme/appearance-store.ts): it is the persistent store
 * already in the build, and none of this is worth a new one. Keys use dots, which SecureStore
 * allows where the web's colons are refused.
 *
 * Every read falls back to "nothing stored" and every write fails quietly: a lost mark costs at
 * most one notification shown twice or one reminder not caught up, never an error on screen.
 */
const MARKS_KEY = 'ultimate-tracker.tray-marks';
const LAST_SYNC_KEY = 'ultimate-tracker.last-sync';
const ASKED_KEY = 'ultimate-tracker.notifications-asked';
const SETUP_OFFERED_KEY = 'ultimate-tracker.background-setup-offered';
const TEST_TIME_KEY = 'ultimate-tracker.test-reminder-time';

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Quiet on purpose — see above.
  }
}

/**
 * The marks belong to one person: stored with their id, so someone else signing in on this phone
 * starts with a first sync rather than with the last person's marks.
 */
export async function loadMarks(userId: string): Promise<TrayMarks | null> {
  const stored = await readJson<{ userId: string; marks: TrayMarks }>(MARKS_KEY);
  return stored?.userId === userId ? stored.marks : null;
}

export function saveMarks(userId: string, marks: TrayMarks): Promise<void> {
  return write(MARKS_KEY, JSON.stringify({ userId, marks }));
}

export function forgetMarks(): Promise<void> {
  return write(MARKS_KEY, null);
}

/** The last sync's outcome, for "Last synced …" in Settings. Kept for the phone, not the person. */
export interface LastSync {
  /** When the last sync ran, ISO date-time. */
  at: string;
  ok: boolean;
  /** When a sync last succeeded, ISO date-time; null if none has on this phone. */
  okAt: string | null;
}

export function loadLastSync(): Promise<LastSync | null> {
  return readJson<LastSync>(LAST_SYNC_KEY);
}

/** Record a sync's outcome, keeping when one last succeeded across failures. */
export async function recordSync(ok: boolean, at: Date = new Date()): Promise<void> {
  const iso = at.toISOString();
  const okAt = ok ? iso : ((await loadLastSync())?.okAt ?? null);
  await write(LAST_SYNC_KEY, JSON.stringify({ at: iso, ok, okAt } satisfies LastSync));
}

/** Once per app, not per person: the permission belongs to the app. */
export async function wasAsked(): Promise<boolean> {
  return (await readJson<boolean>(ASKED_KEY)) === true;
}

export function rememberAsked(): Promise<void> {
  return write(ASKED_KEY, 'true');
}

export async function wasSetupOffered(): Promise<boolean> {
  return (await readJson<boolean>(SETUP_OFFERED_KEY)) === true;
}

export function rememberSetupOffered(): Promise<void> {
  return write(SETUP_OFFERED_KEY, 'true');
}

/** The development build's reminder time, set from the testing tools; null is 09:00. */
export function loadTestReminderTime(): Promise<{ hour: number; minute: number } | null> {
  return __DEV__ ? readJson(TEST_TIME_KEY) : Promise.resolve(null);
}

export function saveTestReminderTime(time: { hour: number; minute: number } | null): Promise<void> {
  return write(TEST_TIME_KEY, time === null ? null : JSON.stringify(time));
}
