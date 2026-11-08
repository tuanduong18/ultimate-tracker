import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Subscriptions from '@/app/(tabs)/finance/subscriptions';
import { daysUntil, todayIso, toIsoDate } from '@/lib/dates';
import { ApiError } from '@/lib/api-error';
import { api, resetApi, serve } from '../../../support/api';
import { category, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

function inDays(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return toIsoDate(day);
}

function subscription(id: string, overrides: object = {}) {
  return {
    id,
    name: id,
    amount: '15.49',
    currency: 'USD',
    interval_unit: 'month',
    interval_count: 1,
    category_id: 'subs',
    started_on: '2026-01-22',
    trial_ends_on: null,
    next_billing_on: inDays(20),
    cancelled_on: null,
    note: null,
    created_at: '2026-01-22T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({ '/finance/categories': [category('subs', 'Subscriptions')] });
});

describe('Subscriptions', () => {
  it('says what each costs, how often, and when it next charges, standing out when soon', async () => {
    serve({
      '/finance/subscriptions': [
        subscription('Netflix', { next_billing_on: inDays(2) }),
        subscription('Gym', { interval_count: 3 }),
      ],
    });
    await renderScreen(<Subscriptions />);

    expect(
      await screen.findByRole('button', {
        name: /^Netflix, .*15\.49 every month\. Renews in 2 days\. Subscriptions\.$/,
      })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Gym, .* every 3 months\. Renews / })
    ).toBeOnTheScreen();
  });

  it('renews early only after saying what it will log, then says it did', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    serve({ '/finance/subscriptions': [subscription('Netflix')] });
    await renderScreen(<Subscriptions />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Renew Netflix now' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Renew now?');
    expect(message).toMatch(/^Logs .*15\.49 today for the .* charge\.$/);
    expect(buttons?.map((b) => [b.text, b.style])).toEqual([
      ['Not now', 'cancel'],
      ['Yes, renew', 'default'],
    ]);
    expect(api.post).not.toHaveBeenCalled();

    await act(async () => buttons?.[1].onPress?.());
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/finance/subscriptions/Netflix/renew', {})
    );
    expect(await screen.findByText(/^Renewed — .*15\.49 logged today\.$/)).toBeOnTheScreen();
  });

  it('says why a renewal was refused, on the row', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    api.post.mockRejectedValueOnce(
      new ApiError(409, { code: 'SUBSCRIPTION_CANCELLED', message: 'Cancelled.' })
    );
    serve({ '/finance/subscriptions': [subscription('Netflix')] });
    await renderScreen(<Subscriptions />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Renew Netflix now' }));
    // The latest dialog: the spy carries the previous test's calls too.
    await act(async () => alert.mock.lastCall?.[2]?.[1].onPress?.());

    expect(await screen.findByText(/clear the cancellation to renew it/)).toBeOnTheScreen();
  });

  it('offers no Renew now where a cancellation stops the next charge', async () => {
    const next = inDays(20);
    serve({
      '/finance/subscriptions': [
        subscription('Netflix', { next_billing_on: next, cancelled_on: next }),
      ],
    });
    await renderScreen(<Subscriptions />);

    await screen.findByRole('button', { name: /^Netflix, / });
    expect(screen.queryByRole('button', { name: 'Renew Netflix now' })).toBeNull();
    expect(daysUntil(next, todayIso())).toBe(20);
  });

  it('says renewals become expenses when there are none yet, and adds one', async () => {
    serve({ '/finance/subscriptions': [] });
    await renderScreen(<Subscriptions />);

    expect(
      await screen.findByText(
        'No subscriptions yet. Each renewal is logged as an expense on its billing date.'
      )
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'New subscription' }));
    expect(router.push).toHaveBeenCalledWith('/subscription');
  });
});
