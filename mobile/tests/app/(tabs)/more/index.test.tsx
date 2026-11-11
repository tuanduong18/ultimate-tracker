import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import More from '@/app/(tabs)/more/index';
import { resetApi, serve } from '../../../support/api';
import { PROFILE, renderScreen } from '../../../support/app';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.0' } }));

const mockSignOut = jest.fn(async () => ({ error: null }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: () => mockSignOut() } } }));

const mockUser = { id: 'u1', email: 'tuan@example.com', user_metadata: {}, app_metadata: {} };
jest.mock('@/auth/session', () => ({ useSession: () => ({ session: { user: mockUser } }) }));

beforeEach(() => {
  resetApi();
  mockSignOut.mockClear();
});

describe('More', () => {
  it('leads the account with the person’s name and email, opening their profile', async () => {
    serve({ '/auth/me': { ...PROFILE, display_name: 'Tuan Nguyen' } });
    await renderScreen(<More />);

    expect(await screen.findByText('Tuan Nguyen')).toBeOnTheScreen();
    expect(screen.getByText('tuan@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Settings')).toBeOnTheScreen();
  });

  it('falls back to the email when there is no name yet', async () => {
    serve({ '/auth/me': PROFILE });
    await renderScreen(<More />);

    expect(await screen.findByText('Profile, sign-in and currencies')).toBeOnTheScreen();
    expect(screen.getByText('tuan@example.com')).toBeOnTheScreen();
  });

  it('logs out without asking, since nothing is kept on the phone', async () => {
    serve({ '/auth/me': PROFILE });
    await renderScreen(<More />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });
});
