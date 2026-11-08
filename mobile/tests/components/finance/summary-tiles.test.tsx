import { screen } from '@testing-library/react-native';

import { SummaryTiles } from '@/components/finance/summary-tiles';
import { monthRange, sameDaysLastMonth, toIsoDate } from '@/lib/dates';
import { resetApi, serve } from '../../support/api';
import { renderScreen } from '../../support/app';

jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const now = monthRange();
const before = sameDaysLastMonth();
const summary = (spent: string) => ({
  currency: 'SGD',
  starts_on: '',
  ends_on: '',
  spent,
  budgeted: '0',
  remaining: '0',
});

function inDays(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return toIsoDate(day);
}

beforeEach(() => resetApi());

describe('SummaryTiles', () => {
  it('says what this month cost and how it compares with the same days of last month', async () => {
    serve({
      [`/finance/summary?start_date=${now.start}&end_date=${now.end}`]: summary('150.00'),
      [`/finance/summary?start_date=${before.start}&end_date=${before.end}`]: summary('100.00'),
      '/finance/subscriptions': [],
    });
    await renderScreen(<SummaryTiles />);

    expect(await screen.findByText(/150\.00/)).toBeOnTheScreen();
    expect(screen.getByText(/^50% more than /)).toBeOnTheScreen();
  });

  it('names the next charge, and how many land in the next 30 days', async () => {
    serve({
      '/finance/summary': summary('0'),
      '/finance/subscriptions': [
        {
          id: 's1',
          name: 'Netflix',
          amount: '15.49',
          currency: 'USD',
          next_billing_on: inDays(1),
          cancelled_on: null,
        },
      ],
    });
    await renderScreen(<SummaryTiles />);

    expect(await screen.findByText('Netflix')).toBeOnTheScreen();
    expect(screen.getByText(/tomorrow/)).toBeOnTheScreen();
    expect(screen.getByText('1 renewal in the next 30 days')).toBeOnTheScreen();
    // Nothing spent yet this month is early, not a saving.
    expect(screen.getByText('Nothing spent yet this month')).toBeOnTheScreen();
  });

  it('says so when no renewal is coming up', async () => {
    serve({ '/finance/summary': summary('0'), '/finance/subscriptions': [] });
    await renderScreen(<SummaryTiles />);

    expect(await screen.findByText('No renewals coming up.')).toBeOnTheScreen();
  });
});
