import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Finance from '@/app/(tabs)/finance/index';
import { api, resetApi, serve } from '../../../support/api';
import { category, expense, PROFILE, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    '/finance/categories': [category('food', 'Food')],
    '/auth/me': PROFILE,
    '/finance/expenses': Array.from({ length: 7 }, (_, i) =>
      expense(`e${i}`, { description: `Expense ${i}` })
    ),
    '/finance/summary': {
      currency: 'SGD',
      starts_on: '',
      ends_on: '',
      spent: '70.00',
      budgeted: '0',
      remaining: '0',
    },
    '/finance/subscriptions': [],
    '/finance/summary/by-category': { currency: 'SGD', starts_on: '', ends_on: '', categories: [] },
    '/finance/summary/by-period': {
      currency: 'SGD',
      starts_on: '',
      ends_on: '',
      granularity: 'day',
      buckets: [],
    },
  });
});

describe('Finance', () => {
  it('lists the five latest expenses and the way to the rest', async () => {
    await renderScreen(<Finance />);

    expect(await screen.findByRole('button', { name: /^Expense 0, / })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Expense 4, / })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Expense 5, / })).toBeNull();
    expect(screen.getByText('All transactions')).toBeOnTheScreen();
  });

  it('opens on this month’s spending, and leads into every part of Finance', async () => {
    await renderScreen(<Finance />);

    expect(await screen.findByText('Spent this month')).toBeOnTheScreen();
    for (const part of ['Budgets', 'Subscriptions', 'Categories']) {
      expect(screen.getByText(part)).toBeOnTheScreen();
    }
  });

  it('adds an expense from the floating button', async () => {
    await renderScreen(<Finance />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    expect(router.push).toHaveBeenCalledWith('/expense');
  });

  it('opens the charts without the categories the account hides from them', async () => {
    serve({
      '/finance/categories': [category('food', 'Food'), category('rent', 'Rent')],
      '/auth/me': { ...PROFILE, chart_hidden_categories: ['rent'] },
    });
    await renderScreen(<Finance />);

    expect(
      await screen.findByRole('button', { name: 'Categories: Categories · 1 hidden' })
    ).toBeOnTheScreen();
    // Asked once, for the saved list — never first for everything, rent included.
    const charts = api.get.mock.calls
      .map(([path]) => path)
      .filter((path) => path.startsWith('/finance/summary/by-'));
    expect(charts.length).toBeGreaterThan(0);
    for (const path of charts) expect(path).toContain('category_ids=food');
  });

  it('saves the ticked categories as where every chart starts', async () => {
    serve({ '/finance/categories': [category('food', 'Food'), category('rent', 'Rent')] });
    await renderScreen(<Finance />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Categories: All categories' })
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Rent' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Save as default/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/auth/me', { chart_hidden_categories: ['rent'] })
    );
  });
});
