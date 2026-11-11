import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Transactions from '@/app/(tabs)/finance/transactions';
import { ApiError } from '@/lib/api-error';
import { api, resetApi, serve } from '../../../support/api';
import { category, expense, PROFILE, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

const mockShare = jest.fn(async (_bytes: Uint8Array, _name: string, _type: string) => undefined);
jest.mock('@/lib/share-file', () => ({
  shareFile: (bytes: Uint8Array, name: string, type: string) => mockShare(bytes, name, type),
}));

const FOOD = category('food', 'Food', { icon: 'food' });
const RENT = category('rent', 'Rent', { colour: '#ef4444', icon: 'home' });
const ROWS = [
  expense('e1', { description: 'GrabFood dinner', category_id: 'food', amount: '25.00' }),
  expense('e2', { description: 'November', category_id: 'rent', amount: '900.00' }),
  expense('e3', { amount: '8.50' }),
];

beforeEach(() => {
  resetApi();
  resetRouter();
  mockShare.mockClear();
  serve({
    '/finance/categories': [FOOD, RENT],
    '/finance/currencies': ['SGD', 'USD'],
    '/auth/me': PROFILE,
    '/finance/expenses': ROWS,
  });
});

describe('Transactions', () => {
  it('lists every expense, category first, and says what they add up to', async () => {
    await renderScreen(<Transactions />);

    expect(await screen.findByRole('button', { name: /^GrabFood dinner, / })).toBeOnTheScreen();
    // No description: the row leads with its category instead.
    expect(screen.getByRole('button', { name: /^Uncategorised, / })).toBeOnTheScreen();
    expect(screen.getByText(/^3 transactions · /)).toHaveTextContent(/933\.50/);
  });

  it('narrows the list as the person types, and counts what is left', async () => {
    await renderScreen(<Transactions />);
    await screen.findByRole('button', { name: /^GrabFood dinner, / });

    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'rent');

    expect(screen.queryByRole('button', { name: /^GrabFood dinner, / })).toBeNull();
    expect(screen.getByRole('button', { name: /^November, / })).toBeOnTheScreen();
    expect(screen.getByText(/^1 of 3 transactions · /)).toBeOnTheScreen();
  });

  it('says it is the filter when nothing matches, and clears it', async () => {
    await renderScreen(<Transactions />);
    await screen.findByRole('button', { name: /^GrabFood dinner, / });

    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'zzz');
    expect(screen.getByText('No transactions match these filters.')).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getByRole('button', { name: /^GrabFood dinner, / })).toBeOnTheScreen();
  });

  it('invites the first expense when there are none, rather than saying a filter is to blame', async () => {
    serve({ '/finance/expenses': [] });
    await renderScreen(<Transactions />);

    expect(await screen.findByText(/^Nothing logged yet\./)).toBeOnTheScreen();
    expect(screen.queryByText('No transactions match these filters.')).toBeNull();
  });

  it('says why the list could not load, never that it is empty, and tries again', async () => {
    serve({
      '/finance/expenses': () => {
        throw new ApiError(503, { code: 'X', message: 'asleep' });
      },
    });
    await renderScreen(<Transactions />);

    expect(await screen.findByText('asleep')).toBeOnTheScreen();
    expect(screen.queryByText(/Nothing logged yet/)).toBeNull();

    serve({ '/finance/expenses': ROWS });
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /^GrabFood dinner, / })).toBeOnTheScreen();
  });

  it('opens a row to edit it, and adds from the floating button', async () => {
    await renderScreen(<Transactions />);

    await fireEvent.press(await screen.findByRole('button', { name: /^November, / }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/expense', params: { id: 'e2' } });

    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(router.push).toHaveBeenCalledWith('/expense');
  });

  it('loads every page of expenses, not just the first', async () => {
    await renderScreen(<Transactions />);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/finance/expenses?limit=500&offset=0')
    );
  });

  it('exports exactly the rows on screen, with the filters in words, to the share sheet', async () => {
    await renderScreen(<Transactions />);
    await screen.findByRole('button', { name: /^GrabFood dinner, / });
    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'grab');

    await fireEvent.press(screen.getByRole('button', { name: 'Export 1 transaction to Excel' }));

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    expect(api.download).toHaveBeenCalledWith('/finance/expenses/export', {
      expense_ids: ['e1'],
      filters: ['Search: grab'],
    });
    expect(mockShare.mock.calls[0][1]).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('says why an export failed, under the buttons', async () => {
    api.download.mockRejectedValueOnce(new Error('offline'));
    await renderScreen(<Transactions />);
    await screen.findByRole('button', { name: /^GrabFood dinner, / });

    await fireEvent.press(screen.getByRole('button', { name: 'Export 3 transactions to Excel' }));

    expect(
      await screen.findByText('Could not export these transactions. Try again.')
    ).toBeOnTheScreen();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('opens the import, even before anything is logged', async () => {
    serve({ '/finance/expenses': [] });
    await renderScreen(<Transactions />);
    await screen.findByText(/^Nothing logged yet\./);

    expect(screen.queryByRole('button', { name: /^Export/ })).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import expenses from a spreadsheet' })
    );
    expect(router.push).toHaveBeenCalledWith('/import-expenses');
  });
});
