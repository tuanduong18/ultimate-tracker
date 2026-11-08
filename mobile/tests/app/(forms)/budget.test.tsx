import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import BudgetScreen from '@/app/(forms)/budget';
import { api, resetApi, serve } from '../../support/api';
import { category, PROFILE, renderScreen } from '../../support/app';
import { resetRouter, router, setParams } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const FOOD = category('food', 'Food');
const FUN = category('fun', 'Fun');
const STORED = {
  id: 'b1',
  name: 'Eating out',
  amount: '300.000',
  currency: 'SGD',
  period: 'monthly',
  starts_on: '2026-10-01',
  ends_on: null,
  warn_at_percent: 80,
  all_spending: false,
  categories: [FOOD],
  created_at: '2026-10-01T00:00:00Z',
};

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    '/finance/categories': [FOOD, FUN],
    '/finance/currencies': ['SGD', 'USD'],
    '/auth/me': PROFILE,
    '/finance/budgets': [STORED],
  });
});

describe('New budget', () => {
  it('adds a monthly budget over the categories ticked, from the month it was opened on', async () => {
    setParams({ month: '2026-12-01' });
    await renderScreen(<BudgetScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Eating out');
    await fireEvent.changeText(screen.getByLabelText('Amount per month'), '300');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Don’t warn early' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add budget' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/finance/budgets', {
        name: 'Eating out',
        amount: '300',
        currency: 'SGD',
        period: 'monthly',
        starts_on: '2026-12-01',
        ends_on: null,
        all_spending: false,
        category_ids: ['food'],
        warn_at_percent: null,
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('asks for what is missing before sending anything', async () => {
    await renderScreen(<BudgetScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add budget' }));

    expect(screen.getByText('Enter a name for the budget.')).toBeOnTheScreen();
    expect(
      screen.getByText('Pick at least one category, or choose All spending.')
    ).toBeOnTheScreen();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('needs an end date for custom dates', async () => {
    await renderScreen(<BudgetScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Custom dates' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Trip');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '900');
    await fireEvent.press(screen.getByRole('radio', { name: 'All spending' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add budget' }));

    expect(screen.getByText('A custom budget needs an end date.')).toBeOnTheScreen();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('points to All spending once every box is ticked', async () => {
    await renderScreen(<BudgetScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Select every category' }));

    expect(
      screen.getByText('To count categories you add later too, choose All spending.')
    ).toBeOnTheScreen();
  });
});

describe('Edit budget', () => {
  it('starts from what was stored and switches it to all spending without its categories', async () => {
    setParams({ id: 'b1' });
    await renderScreen(<BudgetScreen />);

    expect(await screen.findByDisplayValue('Eating out')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Food' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'All spending' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/finance/budgets/b1',
        expect.not.objectContaining({ category_ids: expect.anything() })
      )
    );
    expect(api.patch.mock.calls[0][1]).toMatchObject({ all_spending: true, warn_at_percent: 80 });
  });

  it('deletes after a dialog that says the expenses stay', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: 'b1' });
    await renderScreen(<BudgetScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete budget' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete this budget?');
    expect(message).toMatch(/expenses stay/);

    await buttons?.[1].onPress?.();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/finance/budgets/b1'));
  });
});
