import type { AppNotification } from '@/lib/notifications/notifications';
import { clearTray, syncTray } from '@/lib/notifications/sync';

// --- Android, storage, the session and the API, as the sync sees them ---------------

let mockChannels: { id: string; importance: number }[] = [];
let mockScheduled: string[] = [];
let mockPresented: { request: { identifier: string; content: { title: string; body: string } } }[] =
  [];
const mockSchedule = jest.fn(async (request: { identifier: string }) => request.identifier);
const mockCancel = jest.fn(async (_id: string) => undefined);
const mockDismiss = jest.fn(async (_id: string) => undefined);
const mockDeleteChannel = jest.fn(async (_id: string) => undefined);
const mockSetChannel = jest.fn(async (_id: string, _channel: object) => null);

jest.mock('expo-notifications', () => ({
  AndroidImportance: { NONE: 0, LOW: 2, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelGroupAsync: async () => null,
  setNotificationChannelAsync: (id: string, channel: object) => mockSetChannel(id, channel),
  getNotificationChannelsAsync: async () => mockChannels,
  getNotificationChannelGroupsAsync: async () => [{ id: 'finance' }],
  deleteNotificationChannelAsync: (id: string) => mockDeleteChannel(id),
  deleteNotificationChannelGroupAsync: async () => undefined,
  getAllScheduledNotificationsAsync: async () =>
    mockScheduled.map((identifier) => ({ identifier })),
  getPresentedNotificationsAsync: async () => mockPresented,
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  dismissNotificationAsync: (id: string) => mockDismiss(id),
  scheduleNotificationAsync: (request: { identifier: string }) => mockSchedule(request),
}));

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockStore.set(key, value),
  deleteItemAsync: async (key: string) => void mockStore.delete(key),
}));

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: mockSession } }) } },
}));

const mockGet = jest.fn(async (_path: string): Promise<unknown> => []);
jest.mock('@/lib/api-client', () => ({ api: { get: (path: string) => mockGet(path) } }));

// --- Rows ------------------------------------------------------------------------------

const reminder: AppNotification = {
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
};

const notice: AppNotification = {
  ...reminder,
  id: 'n1',
  kind: 'budget_warning',
  title: 'Food is 80% spent',
  body: 'USD 320.00 of USD 400.00 spent in October 2026, USD 80.00 left.',
  due_on: null,
  alerted_at: '2026-10-20T00:30:00Z',
};

const MARKS_KEY = 'ultimate-tracker.tray-marks';
const LAST_SYNC_KEY = 'ultimate-tracker.last-sync';
const storeMarks = (userId: string, newestNotice: string | null) =>
  mockStore.set(MARKS_KEY, JSON.stringify({ userId, marks: { newestNotice, reminderDays: {} } }));
const stored = (key: string) => JSON.parse(mockStore.get(key) ?? 'null');

beforeEach(() => {
  // 08:00 local on 20 Oct 2026, before the day's 09:00.
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 8, 0), doNotFake: ['nextTick', 'setImmediate'] });
  mockChannels = [];
  mockScheduled = [];
  mockPresented = [];
  mockSession = { user: { id: 'u1' } };
  mockStore.clear();
  mockGet.mockReset().mockResolvedValue([]);
  for (const mock of [mockSchedule, mockCancel, mockDismiss, mockDeleteChannel, mockSetChannel]) {
    mock.mockClear();
  }
});

afterEach(() => jest.useRealTimers());

describe('syncTray', () => {
  it('does nothing for someone signed out, and records nothing', async () => {
    mockSession = null;

    expect(await syncTray({ appOpen: false })).toBe('signed-out');
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockStore.has(LAST_SYNC_KEY)).toBe(false);
  });

  it('leaves everything as it was when the inbox can’t be loaded, and says so', async () => {
    mockScheduled = ['reminder:r1:2026-10-21'];
    mockGet.mockRejectedValue(new Error('Network request failed'));

    expect(await syncTray({ appOpen: false })).toBe('failed');
    expect(mockCancel).not.toHaveBeenCalled();
    expect(stored(LAST_SYNC_KEY)).toMatchObject({ ok: false, okAt: null });
  });

  it('loads the bell’s inbox itself in the background, and schedules each day at 09:00', async () => {
    mockGet.mockResolvedValue([reminder]);

    expect(await syncTray({ appOpen: false })).toBe('synced');

    expect(mockGet).toHaveBeenCalledWith('/notifications?view=inbox&limit=100');
    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: 'reminder:r1:2026-10-20',
      content: {
        title: 'Netflix renews in 3 days',
        body: reminder.body,
        data: { rowId: 'r1', kind: 'subscription_renewal' },
      },
      trigger: {
        type: 'date',
        date: new Date(2026, 9, 20, 9, 0),
        channelId: 'subscription_reminders',
      },
    });
    expect(stored(LAST_SYNC_KEY)).toMatchObject({ ok: true });
  });

  it('remembers the marks for the person signed in', async () => {
    storeMarks('u1', '2026-10-19T00:00:00Z');

    await syncTray({ inbox: [notice], appOpen: false });

    expect(stored(MARKS_KEY)).toEqual({
      userId: 'u1',
      marks: { newestNotice: '2026-10-20T00:30:00Z', reminderDays: {} },
    });
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'notification:n1',
        trigger: { channelId: 'budget_alerts' },
      })
    );
  });

  it('starts fresh for someone new on this phone: none of the last person’s marks', async () => {
    storeMarks('someone-else', '2026-10-19T00:00:00Z');

    await syncTray({ inbox: [notice], appOpen: false });

    // A first sync: what is already in the inbox is in the bell, not the tray.
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(stored(MARKS_KEY).userId).toBe('u1');
  });

  it('puts new words in a tray entry without ringing', async () => {
    jest.setSystemTime(new Date(2026, 9, 20, 10, 0));
    mockStore.set(
      MARKS_KEY,
      JSON.stringify({
        userId: 'u1',
        marks: { newestNotice: null, reminderDays: { r1: '2026-10-22' } },
      })
    );
    mockPresented = [
      {
        request: {
          identifier: 'reminder:r1:2026-10-20',
          content: { title: reminder.title, body: 'old' },
        },
      },
    ];

    await syncTray({ inbox: [reminder], appOpen: false });

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reminder:r1:2026-10-20',
        content: expect.objectContaining({ body: reminder.body, sound: false }),
      })
    );
  });

  it('creates the four channels, and deletes any channel not among them', async () => {
    mockChannels = [
      { id: 'redmi-check', importance: 3 },
      { id: 'budget_alerts', importance: 3 },
    ];

    await syncTray({ inbox: [], appOpen: true });

    expect(mockSetChannel.mock.calls.map(([id]) => id)).toEqual([
      'subscription_reminders',
      'subscription_renewals',
      'budget_alerts',
      'currency_notices',
    ]);
    expect(mockDeleteChannel.mock.calls).toEqual([['redmi-check']]);
  });
});

describe('clearTray', () => {
  it('cancels and clears only what came from the server’s rows, and forgets the marks', async () => {
    storeMarks('u1', null);
    mockScheduled = ['reminder:r1:2026-10-21', 'something-else'];
    mockPresented = [
      { request: { identifier: 'notification:n1', content: { title: '', body: '' } } },
      { request: { identifier: 'not-ours', content: { title: '', body: '' } } },
    ];

    await clearTray();

    expect(mockCancel.mock.calls).toEqual([['reminder:r1:2026-10-21']]);
    expect(mockDismiss.mock.calls).toEqual([['notification:n1']]);
    expect(mockStore.has(MARKS_KEY)).toBe(false);
  });
});
