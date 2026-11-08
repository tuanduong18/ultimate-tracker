import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SubscriptionScreen from '@/app/(forms)/subscription';
import { todayIso } from '@/lib/dates';
import { api, resetApi, serve } from '../../support/api';
import { category, PROFILE, renderScreen } from '../../support/app';
import { resetRouter, router, setParams } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const STORED = {
  id: 's1',
  name: 'Netflix',
  amount: '15.49',
  currency: 'USD',
  interval_unit: 'month',
  interval_count: 1,
  category_id: 'subs',
  started_on: '2026-01-22',
  trial_ends_on: null,
  next_billing_on: '2026-11-22',
  cancelled_on: null,
  note: null,
  created_at: '2026-01-22T00:00:00Z',
};

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    // Food first, but a subscription starts under the category named Subscriptions.
    '/finance/categories': [category('food', 'Food'), category('subs', 'Subscriptions')],
    '/finance/currencies': ['SGD', 'USD'],
    '/auth/me': PROFILE,
    '/finance/subscriptions': [STORED],
  });
});

describe('New subscription', () => {
  it('starts monthly, today, under Subscriptions, and adds it with no cancellation', async () => {
    await renderScreen(<SubscriptionScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Spotify');
    expect(screen.getByRole('radio', { name: 'Subscriptions' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    expect(screen.queryByText('Cancelled on')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Amount'), '11.98');
    await fireEvent.changeText(screen.getByLabelText('Every'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Add subscription' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/finance/subscriptions', {
        name: 'Spotify',
        amount: '11.98',
        currency: 'SGD',
        interval_unit: 'month',
        interval_count: 3,
        category_id: 'subs',
        started_on: todayIso(),
        trial_ends_on: null,
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('reads the unit in the plural once the count is more than one', async () => {
    await renderScreen(<SubscriptionScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Every'), '2');

    expect(screen.getByRole('radio', { name: 'Weeks' })).toBeOnTheScreen();
  });

  it('wants a whole number of units', async () => {
    await renderScreen(<SubscriptionScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Spotify');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '11.98');
    await fireEvent.changeText(screen.getByLabelText('Every'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Add subscription' }));

    expect(screen.getByText('Bill every 1 or more — a whole number.')).toBeOnTheScreen();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Edit subscription', () => {
  it('offers Cancelled on, and sends it explicitly with the rest', async () => {
    setParams({ id: 's1' });
    await renderScreen(<SubscriptionScreen />);

    expect(await screen.findByDisplayValue('Netflix')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancelled on, Still running' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Amount'), '17.99');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/finance/subscriptions/s1',
        expect.objectContaining({ amount: '17.99', cancelled_on: null, trial_ends_on: null })
      )
    );
  });

  it('deletes after saying the logged expenses stay, and pointing to cancelling instead', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: 's1' });
    await renderScreen(<SubscriptionScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete subscription' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete Netflix?');
    expect(message).toMatch(/Expenses it already logged stay\./);

    await buttons?.[1].onPress?.();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/finance/subscriptions/s1'));
  });
});
