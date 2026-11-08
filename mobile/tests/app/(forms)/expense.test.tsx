import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ExpenseScreen from '@/app/(forms)/expense';
import { ApiError } from '@/lib/api-error';
import { todayIso } from '@/lib/dates';
import { api, resetApi, serve } from '../../support/api';
import { category, expense, PROFILE, renderScreen } from '../../support/app';
import { resetRouter, router, setParams } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const RENT = category('rent', 'Rent', { icon: 'home' });
const FOOD = category('food', 'Food', { icon: 'food' });
const LUNCH = expense('e1', {
  amount: '12.50',
  currency: 'USD',
  category_id: 'food',
  description: 'Lunch',
  spent_on: '2026-11-03',
});

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    // Rent first: the person's own order, so a new expense starts on Rent.
    '/finance/categories': [RENT, FOOD],
    '/finance/currencies': ['SGD', 'USD'],
    '/auth/me': PROFILE,
    '/finance/expenses': [LUNCH],
  });
});

describe('Add expense', () => {
  it('starts on the first category and today, and adds the expense', async () => {
    await renderScreen(<ExpenseScreen />);

    const amount = await screen.findByLabelText('Amount');
    expect(screen.getByRole('radio', { name: 'Rent' })).toBeChecked();
    expect(screen.getByRole('button', { name: /^Currency, SGD/ })).toBeOnTheScreen();

    await fireEvent.changeText(amount, '12.5');
    await fireEvent.press(screen.getByRole('radio', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/finance/expenses', {
        amount: '12.5',
        currency: 'SGD',
        category_id: 'food',
        description: null,
        spent_on: todayIso(),
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('explains a missing amount instead of sending it', async () => {
    await renderScreen(<ExpenseScreen />);
    await screen.findByLabelText('Amount');

    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    expect(screen.getByText('Enter an amount like 12.50.')).toBeOnTheScreen();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('words a refusal next to the button and stays open', async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(422, { code: 'INVALID_AMOUNT', message: 'JPY takes no decimals.' })
    );
    await renderScreen(<ExpenseScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Amount'), '1.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('JPY takes no decimals.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('Edit expense', () => {
  it('starts from what was stored and saves the change, clearing a description with null', async () => {
    setParams({ id: 'e1' });
    await renderScreen(<ExpenseScreen />);

    expect(await screen.findByDisplayValue('Lunch')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Food' })).toBeChecked();

    await fireEvent.changeText(screen.getByLabelText('Description'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/finance/expenses/e1', {
        amount: '12.50',
        currency: 'USD',
        category_id: 'food',
        description: null,
        spent_on: '2026-11-03',
      })
    );
  });

  it('deletes only after the second step, naming what goes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: 'e1' });
    await renderScreen(<ExpenseScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete expense' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete this expense?');
    expect(message).toMatch(/^Lunch · .*12\.50/);
    expect(api.delete).not.toHaveBeenCalled();

    await buttons?.[1].onPress?.();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/finance/expenses/e1'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('says so when the expense is no longer there', async () => {
    setParams({ id: 'gone' });
    await renderScreen(<ExpenseScreen />);

    expect(
      await screen.findByText('That expense no longer exists — someone may have deleted it.')
    ).toBeOnTheScreen();
  });
});
