import { screen } from '@testing-library/react-native';

import { niceCeiling, SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import { ALL_CATEGORIES } from '@/lib/finance/categories';
import { api, resetApi, serve } from '../../support/api';
import { renderScreen } from '../../support/app';

jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const WEEK = { start: '2026-11-02', end: '2026-11-08' };

function days(spent: string[]) {
  return {
    currency: 'SGD',
    starts_on: WEEK.start,
    ends_on: WEEK.end,
    granularity: 'day',
    buckets: spent.map((amount, index) => {
      const day = `2026-11-0${index + 2}`;
      return { starts_on: day, ends_on: day, spent: amount };
    }),
  };
}

beforeEach(() => resetApi());

describe('SpendByPeriodChart', () => {
  it('asks for days over a week and reads every bar with spend in words', async () => {
    serve({ '/finance/summary/by-period': days(['0', '12.50', '0', '40', '0', '0', '0']) });
    await renderScreen(<SpendByPeriodChart range={WEEK} selection={ALL_CATEGORIES} />);

    const chart = await screen.findByLabelText(/^Spending by day, /);
    expect(chart.props.accessibilityLabel).toMatch(/12\.50/);
    expect(chart.props.accessibilityLabel).toMatch(/40\.00/);
    expect(api.get).toHaveBeenCalledWith(
      `/finance/summary/by-period?start_date=${WEEK.start}&end_date=${WEEK.end}&granularity=day`
    );
  });

  it('says when nothing was spent in the period', async () => {
    serve({ '/finance/summary/by-period': days(['0', '0', '0', '0', '0', '0', '0']) });
    await renderScreen(<SpendByPeriodChart range={WEEK} selection={ALL_CATEGORIES} />);

    expect(await screen.findByText('Nothing spent in this period yet.')).toBeOnTheScreen();
  });
});

describe('niceCeiling', () => {
  it('rounds the axis up to 1, 2 or 5 of the largest bar’s power of ten', () => {
    expect(niceCeiling(37)).toBe(50);
    expect(niceCeiling(120)).toBe(200);
    expect(niceCeiling(900)).toBe(1000);
    expect(niceCeiling(10)).toBe(10);
    expect(niceCeiling(0)).toBe(1);
  });
});
