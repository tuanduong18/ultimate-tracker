import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/more/profile';
import { ApiError } from '@/lib/api-error';
import { api, resetApi, serve } from '../../../support/api';
import { PROFILE, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

const mockUser = {
  id: 'u1',
  email: 'tuan@example.com',
  user_metadata: { full_name: 'Tuan Nguyen' },
  app_metadata: { providers: ['google', 'email'] },
};
jest.mock('@/auth/session', () => ({ useSession: () => ({ session: { user: mockUser } }) }));

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({ '/auth/me': PROFILE, '/finance/currencies': ['SGD', 'USD', 'VND'] });
});

describe('Profile', () => {
  it('shows who the account is, with the sign-in name as the fallback', async () => {
    await renderScreen(<ProfileScreen />);

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveProp('placeholder', 'Tuan Nguyen');
    expect(name).toHaveDisplayValue('');
    expect(
      screen.getByText('Leave empty to keep using the name from your sign-in provider.')
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Email, tuan@example.com')).toBeOnTheScreen();
    expect(screen.getByLabelText('Signs in with, Google · Email and password')).toBeOnTheScreen();
  });

  it('saves only what changed, then goes back', async () => {
    await renderScreen(<ProfileScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), '  Minh ');
    await fireEvent.press(screen.getByRole('button', { name: 'Report totals in, SGD' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'USD' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/auth/me', {
        display_name: 'Minh',
        display_currency: 'USD',
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('goes back without asking the server when nothing changed', async () => {
    await renderScreen(<ProfileScreen />);
    await screen.findByLabelText('Name');

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('says why a save failed and stays', async () => {
    api.patch.mockRejectedValueOnce(
      new ApiError(422, { code: 'VALIDATION_ERROR', message: 'x', details: [] })
    );
    await renderScreen(<ProfileScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Minh');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Some of those details are not valid.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('offers to try again when the profile can’t load', async () => {
    serve({ '/auth/me': () => Promise.reject(new Error('offline')) });
    await renderScreen(<ProfileScreen />);

    expect(await screen.findByText('Could not load your profile.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
