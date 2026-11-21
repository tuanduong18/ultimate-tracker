import { formatDate, toIsoDate } from '@/lib/dates';
import type { LastSync } from '@/lib/notifications/tray-store';

/**
 * "Last synced …" in the person's words, and whether it looks stuck. Shown in Settings and on the
 * background setup screen, because whether HyperOS lets the sync run can't be read directly: an
 * old time is how it shows.
 */
export interface SyncStatus {
  text: string;
  /** No successful sync in this long is worth the setup screen's attention. */
  behind: boolean;
}

/** Hourly runs, and Android may stretch one: three hours without one is a stopped sync. */
const BEHIND_AFTER_MS = 3 * 60 * 60 * 1000;

export function describeSync(lastSync: LastSync | null, now: Date): SyncStatus {
  if (lastSync === null) return { text: 'Not synced yet on this phone.', behind: false };
  const at = new Date(lastSync.at);
  const okAt = lastSync.okAt === null ? null : new Date(lastSync.okAt);
  const behind = okAt === null || now.getTime() - okAt.getTime() > BEHIND_AFTER_MS;
  if (lastSync.ok) return { text: `Last synced ${when(at, now)}.`, behind };
  const last = okAt === null ? '' : ` Last synced ${when(okAt, now)}.`;
  return { text: `Couldn’t reach the server ${when(at, now)}.${last}`, behind };
}

function when(at: Date, now: Date): string {
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const day = toIsoDate(at);
  if (day === toIsoDate(now)) return `today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === toIsoDate(yesterday)) return `yesterday at ${time}`;
  return `on ${formatDate(day)} at ${time}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
