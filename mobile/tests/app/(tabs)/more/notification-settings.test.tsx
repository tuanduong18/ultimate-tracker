import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import NotificationSettings from '@/app/(tabs)/more/notification-settings';
import { api, resetApi, serve } from '../../../support/api';
import { PROFILE, renderScreen } from '../../../support/app';
import { resetRouter } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

let mockPermission = 'granted';
let mockChannels: { id: string; importance: number }[] = [];
jest.mock('expo-notifications', () => ({
  AndroidImportance: { NONE: 0, LOW: 2, DEFAULT: 3 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  getPermissionsAsync: async () => ({ status: mockPermission }),
  getNotificationChannelsAsync: async () => mockChannels,
}));
jest.mock('expo-background-task', () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  getStatusAsync: async () => 2,
}));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null }));

beforeEach(() => {
  resetApi();
  resetRouter();
  mockPermission = 'granted';
  mockChannels = [];
  serve({ '/auth/me': { ...PROFILE, muted_notifications: ['subscription_renewals'] } });
});

const toggle = (name: string) => screen.findByRole('switch', { name });

describe('Notification settings', () => {
  it('shows the account’s three switches in the web’s words, off for what is muted', async () => {
    await renderScreen(<NotificationSettings />);

    expect(await toggle('Subscription reminders')).toBeChecked();
    expect(await toggle('Renewals')).not.toBeChecked();
    expect(await toggle('Budget alerts')).toBeChecked();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(screen.getByRole('header', { name: 'On every device' })).toBeOnTheScreen();
  });

  it('turning one off sends the whole list', async () => {
    await renderScreen(<NotificationSettings />);

    await fireEvent.press(await toggle('Budget alerts'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/auth/me', {
        muted_notifications: ['subscription_renewals', 'budget_alerts'],
      })
    );
  });

  it('turning one on takes it out of the list', async () => {
    await renderScreen(<NotificationSettings />);

    await fireEvent.press(await toggle('Renewals'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/auth/me', { muted_notifications: [] })
    );
  });

  it('flips back and says so when the save fails', async () => {
    api.patch.mockRejectedValueOnce(new Error('Network request failed'));
    await renderScreen(<NotificationSettings />);

    await fireEvent.press(await toggle('Budget alerts'));

    expect(await screen.findByText(/Budget alerts is still on\.$/)).toBeOnTheScreen();
    expect(await toggle('Budget alerts')).toBeChecked();
  });

  it('shows this phone as Android has it, a channel turned off there included', async () => {
    mockChannels = [
      { id: 'budget_alerts', importance: 0 },
      { id: 'subscription_reminders', importance: 3 },
    ];
    await renderScreen(<NotificationSettings />);

    expect(await screen.findByLabelText('Notifications, Allowed')).toBeOnTheScreen();
    expect(screen.getByLabelText('Budget alerts, Off in Android settings')).toBeOnTheScreen();
    expect(screen.getByLabelText('Subscription reminders, On')).toBeOnTheScreen();
    expect(screen.getByLabelText('Currency notices, On')).toBeOnTheScreen();
    expect(screen.getByText('Not synced yet on this phone.')).toBeOnTheScreen();
  });

  it('says the tray is off when Android refuses the app’s notifications', async () => {
    mockPermission = 'denied';
    await renderScreen(<NotificationSettings />);

    expect(
      await screen.findByLabelText('Notifications, Off in Android settings')
    ).toBeOnTheScreen();
  });
});
