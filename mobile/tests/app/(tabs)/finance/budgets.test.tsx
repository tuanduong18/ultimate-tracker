import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Budgets from '@/app/(tabs)/finance/budgets';
import { formatMonth, monthStart, shiftMonth } from '@/lib/dates';
import { api, resetApi, serve } from '../../../support/api';
import { renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

const THIS_MONTH = monthStart();

function progress(id: string, overrides: object = {}) {
  return {
    id,
    name: id,
    currency: 'SGD',
    amount: '300.00',
    spent: '120.00',
    remaining: '180.00',
    period: 'monthly',
    starts_on: '2026-01-01',
    ends_on: null,
    warn_at_percent: 80,
    window_starts_on: THIS_MONTH,
    window_ends_on: THIS_MONTH,
    all_spending: true,
    categories: [],
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetApi();
  resetRouter();
});

describe('Budgets', () => {
  it('shows each budget’s paid and remaining, and says when one is over in words', async () => {
    serve({
      [`/finance/budgets/progress?month=${THIS_MONTH}`]: [
        progress('Food'),
        progress('Fun', { spent: '350.00', remaining: '-50.00' }),
      ],
    });
    await renderScreen(<Budgets />);

    expect(
      await screen.findByRole('button', { name: /^Food, Monthly\. .* left\./ })
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Fun, Monthly\. .* over\./ })).toBeOnTheScreen();
    expect(screen.getByText('Overshooting')).toBeOnTheScreen();
  });

  it('steps to another month, and back to this one', async () => {
    const next = shiftMonth(THIS_MONTH, 1);
    serve({
      [`/finance/budgets/progress?month=${THIS_MONTH}`]: [progress('Food')],
      [`/finance/budgets/progress?month=${next}`]: [],
    });
    await renderScreen(<Budgets />);
    await screen.findByRole('button', { name: /^Food, / });

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));

    expect(
      await screen.findByText(new RegExp(`^No budgets apply to ${formatMonth(next)}\\.`))
    ).toBeOnTheScreen();
    expect(api.get).toHaveBeenCalledWith(`/finance/budgets/progress?month=${next}`);

    await fireEvent.press(
      screen.getByRole('button', { name: `Back to ${formatMonth(THIS_MONTH)}` })
    );
    expect(await screen.findByRole('button', { name: /^Food, / })).toBeOnTheScreen();
  });

  it('opens a budget to edit, and adds one starting in the month on screen', async () => {
    serve({ [`/finance/budgets/progress?month=${THIS_MONTH}`]: [progress('Food')] });
    await renderScreen(<Budgets />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Food, / }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/budget',
      params: { id: 'Food', month: THIS_MONTH },
    });

    await fireEvent.press(screen.getByRole('button', { name: 'New budget' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/budget',
        params: { month: THIS_MONTH },
      })
    );
  });
});
