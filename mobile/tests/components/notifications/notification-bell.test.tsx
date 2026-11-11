import { fireEvent, screen } from '@testing-library/react-native';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { resetApi, serve } from '../../support/api';
import { renderScreen } from '../../support/app';
import { resetRouter, router } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const unread = (id: string) => ({ id, read_at: null });
const read = (id: string) => ({ id, read_at: '2026-11-10T00:00:00Z' });

beforeEach(() => {
  resetApi();
  resetRouter();
});

describe('NotificationBell', () => {
  it('counts what is new, in words for TalkBack and on the badge', async () => {
    serve({ '/notifications?view=inbox&limit=100': [unread('a'), unread('b'), read('c')] });
    await renderScreen(<NotificationBell />);

    expect(await screen.findByRole('button', { name: 'Notifications, 2 new' })).toBeOnTheScreen();
    // The badge is hidden from TalkBack, which hears the count in the label instead.
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('caps the badge at 9+', async () => {
    serve({
      '/notifications?view=inbox&limit=100': Array.from({ length: 12 }, (_, i) => unread(`n${i}`)),
    });
    await renderScreen(<NotificationBell />);

    expect(await screen.findByText('9+', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('shows no badge, not a zero, when nothing is new — and opens Notifications', async () => {
    serve({ '/notifications?view=inbox&limit=100': [read('a')] });
    await renderScreen(<NotificationBell />);

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    expect(screen.queryByText('0', { includeHiddenElements: true })).toBeNull();

    await fireEvent.press(bell);
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });
});
