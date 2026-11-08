import { screen } from '@testing-library/react-native';

import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { ALL_CATEGORIES } from '@/lib/finance/categories';
import { resetApi, serve } from '../../support/api';
import { renderScreen } from '../../support/app';

jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const OCTOBER = { start: '2026-10-01', end: '2026-10-31' };
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };

function breakdown(range: { start: string; end: string }, rows: [string | null, string][]) {
  return {
    currency: 'SGD',
    starts_on: range.start,
    ends_on: range.end,
    categories: rows.map(([id, spent]) => ({
      category_id: id,
      name: id ?? 'Uncategorised',
      colour: '#22c55e',
      spent,
    })),
  };
}

function serveBoth(now: [string | null, string][], before: [string | null, string][]) {
  serve({
    [`/finance/summary/by-category?start_date=${OCTOBER.start}&end_date=${OCTOBER.end}`]: breakdown(
      OCTOBER,
      now
    ),
    [`/finance/summary/by-category?start_date=${SEPTEMBER.start}&end_date=${SEPTEMBER.end}`]:
      breakdown(SEPTEMBER, before),
  });
}

beforeEach(() => resetApi());

describe('SpendByCategoryChart', () => {
  it('gives every category its amount and its share now and in the period before, in words', async () => {
    serveBoth(
      [
        ['Food', '75'],
        ['Rent', '25'],
      ],
      [
        ['Food', '50'],
        ['Rent', '50'],
      ]
    );
    await renderScreen(<SpendByCategoryChart range={OCTOBER} selection={ALL_CATEGORIES} />);

    expect(
      await screen.findByLabelText(
        /^Food: .*75\.00, 75% of this period, 50% of the period before\.$/
      )
    ).toBeOnTheScreen();
    expect(screen.getByText('50% → 25%')).toBeOnTheScreen();
    // The ring is heard as its total, not skipped.
    expect(screen.getByLabelText(/100\.00 spent, /)).toBeOnTheScreen();
  });

  it('folds the tail into Others once there are more than five', async () => {
    serveBoth(
      [
        ['A', '6'],
        ['B', '5'],
        ['C', '4'],
        ['D', '3'],
        ['E', '2'],
        ['F', '1'],
      ],
      []
    );
    await renderScreen(<SpendByCategoryChart range={OCTOBER} selection={ALL_CATEGORIES} />);

    expect(await screen.findByText('Others (2)')).toBeOnTheScreen();
  });

  it('says when nothing was spent in either period', async () => {
    serveBoth([], []);
    await renderScreen(<SpendByCategoryChart range={OCTOBER} selection={ALL_CATEGORIES} />);

    expect(
      await screen.findByText(/^Nothing spent in .* or the period before\.$/)
    ).toBeOnTheScreen();
  });

  it('says no categories are selected rather than asking the API for none', async () => {
    await renderScreen(
      <SpendByCategoryChart range={OCTOBER} selection={{ ids: [], uncategorized: false }} />
    );

    expect(screen.getByText('No categories selected.')).toBeOnTheScreen();
  });
});
