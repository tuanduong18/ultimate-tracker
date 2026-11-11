import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Notifications from '@/app/notifications';
import { ApiError } from '@/lib/api-error';
import type { AppNotification } from '@/lib/notifications/notifications';
import { api, resetApi, serve } from '../support/api';
import { renderScreen } from '../support/app';
import { resetRouter, router } from '../support/router';

jest.mock('expo-router', () => jest.requireActual('../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../support/api').apiClient);
// Realtime is mounted under the tabs, not here; the module only needs to load.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

function notification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    kind: 'subscription_renewal',
    title: 'Netflix renews in 3 days',
    body: 'SGD 19.98 will be charged on 14 Nov 2026.',
    due_on: '2026-11-14',
    read_at: null,
    snoozed_at: null,
    archived_at: null,
    alerted_at: '2026-11-11T01:00:00Z',
    created_at: '2026-11-11T01:00:00Z',
    ...overrides,
  };
}

const REMINDER = notification('n1');
const BUDGET = notification('n2', {
  kind: 'budget_exceeded',
  title: 'Food is over budget',
  body: 'S$412.00 of S$400.00 spent in November.',
  due_on: null,
  read_at: '2026-11-10T01:00:00Z',
});
const RENEWED = notification('n3', {
  kind: 'subscription_renewed',
  title: 'Spotify renewed',
  body: 'S$11.98 was recorded as an expense.',
  archived_at: '2026-11-09T01:00:00Z',
  read_at: '2026-11-09T01:00:00Z',
});

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    '/notifications?view=inbox&limit=100': [REMINDER, BUDGET],
    '/notifications?view=history&limit=100': [RENEWED],
  });
});

describe('Notifications', () => {
  it('shows the inbox and the history, each counted', async () => {
    await renderScreen(<Notifications />);

    expect(await screen.findByRole('header', { name: 'Inbox · 2' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'History · 1' })).toBeOnTheScreen();
    expect(screen.getByText('Food is over budget')).toBeOnTheScreen();
    expect(screen.getByText('Spotify renewed')).toBeOnTheScreen();
  });

  it('marks what was unread as read on opening, and keeps it marked new while open', async () => {
    await renderScreen(<Notifications />);

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/notifications/n1', { read: true })
    );
    // Only the unread one: the budget alert was read before.
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'New: Netflix renews in 3 days' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Food is over budget' })).toBeOnTheScreen();
  });

  it('offers each kind its own action, in the web’s words', async () => {
    await renderScreen(<Notifications />);
    await screen.findByText('Netflix renews in 3 days');

    expect(screen.getByRole('button', { name: 'Snooze' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
  });

  it('snoozes a reminder on the server', async () => {
    await renderScreen(<Notifications />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Snooze' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/notifications/n1', { snoozed: true })
    );
  });

  it('deletes from the history only after the confirm dialog', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen(<Notifications />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

    expect(api.delete).not.toHaveBeenCalled();
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete this notification?');
    expect(message).toMatch(/^Spotify renewed\. This can’t be undone\.$/);

    await buttons?.[1].onPress?.();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/notifications/n3'));
  });

  it('opens what a notification is about, in its own tab', async () => {
    await renderScreen(<Notifications />);
    await fireEvent.press(await screen.findByRole('link', { name: 'View budgets' }));

    expect(router.dismissTo).toHaveBeenCalledWith('/finance/budgets');
  });

  it('says why an action failed, under its row', async () => {
    api.patch.mockImplementation(async (_path: string, body: unknown) => {
      if ((body as { snoozed?: boolean }).snoozed) {
        throw new ApiError(404, { code: 'NOT_FOUND', message: 'gone' });
      }
      return body;
    });
    await renderScreen(<Notifications />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Snooze' }));

    expect(
      await screen.findByText('That item no longer exists — someone may have deleted it.')
    ).toBeOnTheScreen();
  });

  it('says so when there is nothing, and never while it is loading', async () => {
    // The inbox is held back until the test lets it go. An instant answer would make "still
    // loading" a race: it reaches the screen on a setTimeout(0), the render returns on a
    // setImmediate, and on a busy runner the empty message was already showing.
    let answer: (rows: AppNotification[]) => void = () => {};
    const inbox = new Promise<AppNotification[]>((resolve) => {
      answer = resolve;
    });
    serve({
      '/notifications?view=inbox&limit=100': () => inbox,
      '/notifications?view=history&limit=100': [],
    });
    await renderScreen(<Notifications />);

    expect(screen.queryByText('Nothing needs you right now.')).toBeNull();

    await act(async () => answer([]));
    expect(await screen.findByText('Nothing needs you right now.')).toBeOnTheScreen();
    expect(
      screen.getByText('Snoozed reminders and past renewals will show up here.')
    ).toBeOnTheScreen();
  });
});
