import type { AppNotification, NotificationKind } from '@/lib/notifications/notifications';
import {
  countdownTitle,
  planTray,
  when,
  type TrayInputs,
  type TrayMarks,
} from '@/lib/notifications/tray-plan';

// 08:00 local on Tuesday 20 Oct 2026: before today's 09:00.
const MORNING = new Date(2026, 9, 20, 8, 0);
const LATER = new Date(2026, 9, 20, 10, 0);

function reminder(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'r1',
    kind: 'subscription_renewal',
    title: 'Netflix renews in 3 days',
    body: 'USD 15.49 will be charged on 23 Oct 2026.',
    due_on: '2026-10-23',
    read_at: null,
    snoozed_at: null,
    archived_at: null,
    alerted_at: '2026-10-19T17:00:00Z',
    created_at: '2026-10-19T17:00:00Z',
    ...overrides,
  };
}

function notice(id: string, alertedAt: string, overrides: Partial<AppNotification> = {}) {
  return reminder({
    id,
    kind: 'budget_warning',
    title: 'Food is 80% spent',
    body: 'USD 320.00 of USD 400.00 spent in October 2026, USD 80.00 left.',
    due_on: null,
    alerted_at: alertedAt,
    ...overrides,
  });
}

const SYNCED: TrayMarks = { newestNotice: '2026-10-19T00:00:00Z', reminderDays: {} };

function plan(overrides: Partial<TrayInputs>) {
  return planTray({
    inbox: [],
    now: MORNING,
    scheduled: [],
    presented: [],
    marks: SYNCED,
    appOpen: false,
    ...overrides,
  });
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);
const nineOn = (day: number) => new Date(2026, 9, day, 9, 0);

describe('notices', () => {
  it('shows a new unread notice once, in its category’s channel', () => {
    const inbox = [notice('n1', '2026-10-20T01:00:00Z')];

    const first = plan({ inbox });

    expect(first.show).toEqual([
      expect.objectContaining({ id: 'notification:n1', channel: 'budget_alerts', silent: false }),
    ]);
    expect(first.marks.newestNotice).toBe('2026-10-20T01:00:00Z');
    expect(plan({ inbox, marks: first.marks }).show).toEqual([]);
  });

  it('shows nothing on the first sync, and starts counting from the newest', () => {
    const result = plan({ inbox: [notice('n1', '2026-10-20T01:00:00Z')], marks: null });

    expect(result.show).toEqual([]);
    expect(result.marks.newestNotice).toBe('2026-10-20T01:00:00Z');
  });

  it('after a first sync with an empty inbox, shows the next notice', () => {
    const marks = { newestNotice: null, reminderDays: {} };

    expect(ids(plan({ inbox: [notice('n1', '2026-10-20T01:00:00Z')], marks }).show)).toEqual([
      'notification:n1',
    ]);
  });

  it('leaves new notices to the bell while the app is open, and counts them as shown', () => {
    const result = plan({ inbox: [notice('n1', '2026-10-20T01:00:00Z')], appOpen: true });

    expect(result.show).toEqual([]);
    expect(result.marks.newestNotice).toBe('2026-10-20T01:00:00Z');
  });

  it('shows each notice that arrived while offline, oldest first', () => {
    const inbox = [notice('n2', '2026-10-20T03:00:00Z'), notice('n1', '2026-10-20T01:00:00Z')];

    expect(ids(plan({ inbox }).show)).toEqual(['notification:n1', 'notification:n2']);
  });

  it('never shows a notice already read on another device', () => {
    const read = notice('n1', '2026-10-20T01:00:00Z', { read_at: '2026-10-20T02:00:00Z' });

    expect(plan({ inbox: [read] }).show).toEqual([]);
  });

  it('clears a notice from the tray once it is read, archived or deleted elsewhere', () => {
    const presented = [{ id: 'notification:n1', title: 'Food is 80% spent', body: '…' }];
    const read = notice('n1', '2026-10-18T01:00:00Z', { read_at: '2026-10-20T02:00:00Z' });

    expect(plan({ inbox: [read], presented }).dismiss).toEqual(['notification:n1']);
    // Archived and deleted rows are no longer in the inbox at all.
    expect(plan({ inbox: [], presented }).dismiss).toEqual(['notification:n1']);
  });

  it('puts a currency notice in its own channel', () => {
    const delisted = notice('n1', '2026-10-20T01:00:00Z', { kind: 'currency_delisted' });

    expect(plan({ inbox: [delisted] }).show[0]?.channel).toBe('currency_notices');
  });

  it('skips a kind this version of the app does not know, without failing', () => {
    // An APK older than the server meets a kind added after it was built.
    const unknown = notice('n1', '2026-10-20T01:00:00Z', { kind: 'step_goal' as NotificationKind });

    expect(plan({ inbox: [unknown] }).show).toEqual([]);
  });
});

describe('reminders', () => {
  it('schedules today, tomorrow and the day after at 09:00 when synced before 09:00', () => {
    const result = plan({ inbox: [reminder()] });

    expect(result.schedule.map((item) => [item.id, item.title, item.at])).toEqual([
      ['reminder:r1:2026-10-20', 'Netflix renews in 3 days', nineOn(20)],
      ['reminder:r1:2026-10-21', 'Netflix renews in 2 days', nineOn(21)],
      ['reminder:r1:2026-10-22', 'Netflix renews tomorrow', nineOn(22)],
    ]);
    expect(result.schedule[0]?.channel).toBe('subscription_reminders');
    expect(result.marks.reminderDays).toEqual({ r1: '2026-10-22' });
  });

  it('shows today’s at once when first synced after 09:00, and schedules the rest', () => {
    const result = plan({ inbox: [reminder()], now: LATER });

    expect(ids(result.show)).toEqual(['reminder:r1:2026-10-20']);
    expect(ids(result.schedule)).toEqual(['reminder:r1:2026-10-21', 'reminder:r1:2026-10-22']);
  });

  it('does not bring back today’s once swiped away, and still fires tomorrow’s', () => {
    // The morning sync scheduled through the 22nd; 09:00 fired; it was swiped away.
    const marks = { ...SYNCED, reminderDays: { r1: '2026-10-22' } };

    const result = plan({ inbox: [reminder()], now: LATER, marks });

    expect(result.show).toEqual([]);
    expect(ids(result.schedule)).toEqual(['reminder:r1:2026-10-21', 'reminder:r1:2026-10-22']);
  });

  it('on the first sync, schedules ahead but leaves today’s to the bell', () => {
    const result = plan({ inbox: [reminder()], now: LATER, marks: null });

    expect(result.show).toEqual([]);
    expect(result.schedule).toHaveLength(2);
  });

  it('counts a trial down in its own words', () => {
    const trial = reminder({ kind: 'trial_ending', title: 'Your Netflix trial ends in 3 days' });

    expect(plan({ inbox: [trial] }).schedule.map((item) => item.title)).toEqual([
      'Your Netflix trial ends in 3 days',
      'Your Netflix trial ends in 2 days',
      'Your Netflix trial ends tomorrow',
    ]);
  });

  it('after an edit, reschedules with the new words and replaces today’s entry silently', () => {
    const edited = reminder({ body: 'USD 17.99 will be charged on 23 Oct 2026.' });
    const presented = [
      { id: 'reminder:r1:2026-10-20', title: 'Netflix renews in 3 days', body: reminder().body },
    ];
    const marks = { ...SYNCED, reminderDays: { r1: '2026-10-22' } };

    const result = plan({ inbox: [edited], now: LATER, presented, marks });

    expect(result.show).toEqual([
      expect.objectContaining({ id: 'reminder:r1:2026-10-20', body: edited.body, silent: true }),
    ]);
    expect(result.schedule.every((item) => item.body === edited.body)).toBe(true);
  });

  it('cancels and clears a reminder that left the inbox — snoozed, cancelled or moved', () => {
    const result = plan({
      inbox: [],
      scheduled: ['reminder:old:2026-10-21', 'reminder:old:2026-10-22'],
      presented: [{ id: 'reminder:old:2026-10-20', title: 'Netflix renews in 3 days', body: '…' }],
      marks: { ...SYNCED, reminderDays: { old: '2026-10-22' } },
    });

    expect(result.cancel).toEqual(['reminder:old:2026-10-21', 'reminder:old:2026-10-22']);
    expect(result.dismiss).toEqual(['reminder:old:2026-10-20']);
    expect(result.marks.reminderDays).toEqual({});
  });

  it('clears today’s entry once read elsewhere, and still schedules the days to come', () => {
    const read = reminder({ read_at: '2026-10-20T03:00:00Z' });
    const presented = [
      { id: 'reminder:r1:2026-10-20', title: 'Netflix renews in 3 days', body: reminder().body },
    ];

    const result = plan({ inbox: [read], now: LATER, presented });

    expect(result.dismiss).toEqual(['reminder:r1:2026-10-20']);
    expect(result.schedule).toHaveLength(2);
  });

  it('clears yesterday’s countdown entry', () => {
    const presented = [
      { id: 'reminder:r1:2026-10-19', title: 'Netflix renews in 4 days', body: reminder().body },
    ];

    expect(plan({ inbox: [reminder()], presented }).dismiss).toEqual(['reminder:r1:2026-10-19']);
  });

  it('schedules nothing on the charge day itself', () => {
    const due = reminder({ title: 'Netflix renews tomorrow', due_on: '2026-10-20' });

    const result = plan({ inbox: [due], now: LATER });

    expect([result.schedule, result.show]).toEqual([[], []]);
  });

  it('keeps two subscriptions renewing the same day as separate entries', () => {
    const result = plan({
      inbox: [reminder(), reminder({ id: 'r2', title: 'Spotify renews in 3 days' })],
    });

    expect(ids(result.schedule).filter((id) => id.endsWith('2026-10-22'))).toEqual([
      'reminder:r1:2026-10-22',
      'reminder:r2:2026-10-22',
    ]);
  });
});

describe('what is not the tray’s', () => {
  it('leaves other notifications the app has scheduled or shown alone', () => {
    const result = plan({
      scheduled: ['redmi-check:alarm:1'],
      presented: [{ id: 'redmi-check:replace', title: 'Replace test', body: '…' }],
    });

    expect([result.cancel, result.dismiss]).toEqual([[], []]);
  });
});

describe('the countdown words', () => {
  it('match the server’s', () => {
    expect([when(3), when(2), when(1)]).toEqual(['in 3 days', 'in 2 days', 'tomorrow']);
  });

  it('swap only a countdown at the end of a title', () => {
    expect(countdownTitle('Netflix renews tomorrow', 2)).toBe('Netflix renews in 2 days');
    expect(countdownTitle('Netflix renewed', 2)).toBe('Netflix renewed');
  });
});
