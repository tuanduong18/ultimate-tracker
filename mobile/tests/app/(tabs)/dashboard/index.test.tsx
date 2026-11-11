import { fireEvent, screen } from '@testing-library/react-native';

import Dashboard from '@/app/(tabs)/dashboard/index';
import { resetApi, serve } from '../../../support/api';
import { PROFILE, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

const mockSession = { user: { id: 'u1', email: 'tuan@example.com', user_metadata: {} } };
jest.mock('@/auth/session', () => ({ useSession: () => ({ session: mockSession }) }));

const SUMMARY = {
  currency: 'SGD',
  starts_on: '',
  ends_on: '',
  spent: '120.00',
  budgeted: '0',
  remaining: '0',
};

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    '/auth/me': { ...PROFILE, display_name: 'Tuan Nguyen' },
    '/finance/summary': SUMMARY,
    '/finance/subscriptions': [],
  });
});

describe('Dashboard', () => {
  it('greets the person by first name', async () => {
    await renderScreen(<Dashboard />);

    expect(await screen.findByText('Welcome back, Tuan')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your life, at a glance' })).toBeOnTheScreen();
  });

  it('shows this month’s money as Finance does, and opens Finance', async () => {
    await renderScreen(<Dashboard />);

    expect(await screen.findByRole('header', { name: 'Spent this month' })).toBeOnTheScreen();
    expect(await screen.findByText(/120\.00/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'See all finance' }));
    expect(router.navigate).toHaveBeenCalledWith('/finance');
  });

  it('lists every module but itself, tagging the ones still to come', async () => {
    await renderScreen(<Dashboard />);
    await screen.findByText('Welcome back, Tuan');

    expect(screen.getByText('Finance')).toBeOnTheScreen();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getAllByText('Coming in v0.2')).toHaveLength(2);
    expect(screen.getByText('Coming in v0.3')).toBeOnTheScreen();
    expect(screen.getByText('Coming in the final release')).toBeOnTheScreen();
  });
});
