import { daysUntil, fromIso, toIsoDate } from '@/lib/dates';
import { CATEGORY_OF, type Category } from '@/lib/notifications/categories';
import {
  isReminder,
  type AppNotification,
  type NotificationKind,
} from '@/lib/notifications/notifications';

/**
 * The phone's tray, planned from the server's inbox — what a sync decides, with no Android call
 * in it, so every rule is a Jest test. `sync.ts` loads the inputs and applies the plan.
 * The behaviour is docs/features/platform.md § Phone notifications.
 *
 * Nothing about the tray is stored on the server. Each local notification's id is built from its
 * server row: `notification:<row id>` for a notice, `reminder:<row id>:<YYYY-MM-DD>` for one day
 * of a reminder's countdown. Android keeps what is scheduled and what is in the tray; comparing
 * those ids with the rows just loaded is how a sync finds what changed. It rebuilds rather than
 * patches: every reminder day still wanted is scheduled again, and every one no longer wanted is
 * cancelled, so an edit on the web reaches the phone at its next sync.
 */

/** Reminders ring at 09:00 local, never when the server rewrites them around midnight. */
export const REMINDER_TIME = { hour: 9, minute: 0 };

const NOTICE = 'notification:';
const REMINDER = 'reminder:';

/** What a sync remembers between runs, per signed-in person, forgotten at log out. */
export interface TrayMarks {
  /** `alerted_at` of the newest notice already handled — shown, or skipped on purpose. */
  newestNotice: string | null;
  /** For each live reminder row, the last day (YYYY-MM-DD) shown or scheduled. */
  reminderDays: Record<string, string>;
}

export interface TrayEntry {
  id: string;
  channel: Category;
  title: string;
  body: string;
  /** The server row, for a tap to open its subject and mark it read. */
  rowId: string;
  kind: NotificationKind;
}

export interface TrayPlan {
  /** Scheduled ids no longer wanted. */
  cancel: string[];
  /** Every reminder day still to come, each at its 09:00. Scheduling an id again replaces it. */
  schedule: (TrayEntry & { at: Date })[];
  /** Shown now. `silent`: new words in place of an entry already in the tray, without ringing. */
  show: (TrayEntry & { silent: boolean })[];
  /** Tray entries whose row is gone, read, snoozed or archived, or whose day has passed. */
  dismiss: string[];
  /** To store once the plan has been applied. */
  marks: TrayMarks;
}

export interface TrayInputs {
  /** `GET /notifications?view=inbox&limit=100`: neither snoozed nor archived. */
  inbox: readonly AppNotification[];
  now: Date;
  /** Ids Android holds as scheduled, any app's prefix (others are left alone). */
  scheduled: readonly string[];
  /** What is in the tray now. */
  presented: readonly { id: string; title: string; body: string }[];
  /** null: the first sync for this person on this phone. */
  marks: TrayMarks | null;
  /** In front: new rows reach the bell instead, and count as shown. */
  appOpen: boolean;
}

export function planTray({
  inbox,
  now,
  scheduled,
  presented,
  marks,
  appOpen,
}: TrayInputs): TrayPlan {
  const today = toIsoDate(now);
  const first = marks === null;
  const show: TrayPlan['show'] = [];
  const schedule: TrayPlan['schedule'] = [];
  const reminderDays: Record<string, string> = {};
  // What the tray should hold now, by id, with its words: anything else of ours goes.
  const keep = new Map<string, { row: AppNotification; title: string }>();

  // --- Notices: shown once, when new ------------------------------------------------
  const notices = inbox
    .filter((row) => !isReminder(row) && CATEGORY_OF[row.kind] !== undefined)
    .sort((a, b) => Date.parse(a.alerted_at) - Date.parse(b.alerted_at));
  const after =
    marks === null || marks.newestNotice === null ? null : Date.parse(marks.newestNotice);
  let newestNotice = marks?.newestNotice ?? null;
  for (const row of notices) {
    const alerted = Date.parse(row.alerted_at);
    const id = `${NOTICE}${row.id}`;
    if (row.read_at === null) keep.set(id, { row, title: row.title });
    // The first sync starts fresh: what is already in the inbox is in the bell.
    const fresh = !first && (after === null || alerted > after);
    if (fresh && row.read_at === null && !appOpen) {
      show.push({ ...entry(row, id, row.title), silent: false });
    }
    if (newestNotice === null || alerted > Date.parse(newestNotice)) newestNotice = row.alerted_at;
  }

  // --- Reminders: one notification per day left, at 09:00 ----------------------------
  for (const row of inbox) {
    if (!isReminder(row) || row.due_on === null) continue;
    let handled = marks?.reminderDays[row.id];
    for (const day of daysBefore(today, row.due_on)) {
      const id = `${REMINDER}${row.id}:${day}`;
      const title = countdownTitle(row.title, daysUntil(row.due_on, day));
      const at = fromIso(day)!;
      at.setHours(REMINDER_TIME.hour, REMINDER_TIME.minute, 0, 0);
      if (at > now) {
        schedule.push({ ...entry(row, id, title), at });
      } else {
        // Today's 09:00 has passed. Shown now only if it never was: a swiped-away entry and
        // one never shown look the same to the app, so the day mark tells them apart.
        const unseen = handled === undefined || handled < day;
        if (unseen && !first && !appOpen && row.read_at === null) {
          show.push({ ...entry(row, id, title), silent: false });
        }
        if (row.read_at === null) keep.set(id, { row, title });
      }
      if (handled === undefined || day > handled) handled = day;
    }
    if (handled !== undefined) reminderDays[row.id] = handled;
  }

  // --- The tray as it is: keep, replace in place, or clear ----------------------------
  const dismiss: string[] = [];
  const showing = new Set(show.map((item) => item.id));
  for (const item of presented) {
    if (!ours(item.id) || showing.has(item.id)) continue;
    const wanted = keep.get(item.id);
    if (wanted === undefined) {
      dismiss.push(item.id);
    } else if (wanted.title !== item.title || wanted.row.body !== item.body) {
      show.push({ ...entry(wanted.row, item.id, wanted.title), silent: true });
    }
  }

  const wantedLater = new Set(schedule.map((item) => item.id));
  return {
    cancel: scheduled.filter((id) => ours(id) && !wantedLater.has(id)),
    schedule,
    show,
    dismiss,
    marks: { newestNotice, reminderDays },
  };
}

/** The server's countdown words, `_when` in backend/app/services/finance/reminders.py: a twin. */
export function when(daysLeft: number): string {
  return daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
}

const COUNTDOWN = /(?:in \d+ days|tomorrow)$/;

/**
 * A day's title: the row's, with its countdown swapped for that day's — "Netflix renews in 3
 * days" becomes "…renews tomorrow" for the last day. Every day is worked out this way, today's
 * too, so a sync just after midnight, before the server's job has rewritten the row, still says
 * the right thing. A title without a countdown is used as it is.
 */
export function countdownTitle(title: string, daysLeft: number): string {
  return COUNTDOWN.test(title) ? title.replace(COUNTDOWN, when(daysLeft)) : title;
}

/** Today and each day after it, up to the day before the charge. None on the charge day. */
function daysBefore(today: string, dueOn: string): string[] {
  const days: string[] = [];
  const day = fromIso(today)!;
  while (toIsoDate(day) < dueOn) {
    days.push(toIsoDate(day));
    day.setDate(day.getDate() + 1);
  }
  return days;
}

function entry(row: AppNotification, id: string, title: string): TrayEntry {
  return {
    id,
    channel: CATEGORY_OF[row.kind],
    title,
    body: row.body,
    rowId: row.id,
    kind: row.kind,
  };
}

function ours(id: string): boolean {
  return id.startsWith(NOTICE) || id.startsWith(REMINDER);
}
