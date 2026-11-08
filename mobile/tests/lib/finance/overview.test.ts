import {
  granularityFor,
  nextRenewal,
  OTHERS_COLOUR,
  share,
  spendingChange,
  toRows,
} from '@/lib/finance/overview';
import type { CategoryBreakdown, Subscription } from '@/lib/finance/types';
import { NEUTRAL_COLOUR } from '@/lib/tint';

const BEFORE = { start: '2026-10-01', end: '2026-10-07' };

describe('spendingChange', () => {
  it('reads an early, empty month as early rather than as a saving', () => {
    expect(spendingChange('0', '120', BEFORE)).toEqual({
      text: 'Nothing spent yet this month',
      trend: null,
    });
  });

  it('says how much more or less, rounded, and which way it went', () => {
    expect(spendingChange('150', '100', BEFORE)).toMatchObject({
      text: expect.stringMatching(/^50% more than /),
      trend: 'up',
    });
    expect(spendingChange('75', '100', BEFORE)).toMatchObject({
      text: expect.stringMatching(/^25% less than /),
      trend: 'down',
    });
    expect(spendingChange('100.4', '100', BEFORE).text).toMatch(/^Level with /);
  });

  it('has nothing to compare with when nothing was spent before', () => {
    expect(spendingChange('50', '0', BEFORE).text).toMatch(/^Nothing spent /);
  });
});

describe('nextRenewal', () => {
  const sub = (id: string, next: string, cancelled: string | null = null) =>
    ({ id, name: id, next_billing_on: next, cancelled_on: cancelled }) as Subscription;

  it('picks the soonest live charge still to come, and counts the next 30 days', () => {
    const result = nextRenewal(
      [
        sub('later', '2026-12-20'),
        sub('soon', '2026-11-10'),
        sub('past', '2026-11-01'),
        sub('cancelled', '2026-11-08', '2026-11-05'),
      ],
      '2026-11-07'
    );
    expect(result.next?.id).toBe('soon');
    expect(result.withinMonth).toBe(1);
  });

  it('has none to show when nothing is coming up', () => {
    expect(nextRenewal([], '2026-11-07')).toEqual({ next: null, withinMonth: 0 });
  });
});

describe('granularityFor', () => {
  it('draws days for a month or less and weeks beyond', () => {
    expect(granularityFor({ start: '2026-10-01', end: '2026-10-31' })).toBe('day');
    expect(granularityFor({ start: '2026-10-01', end: '2026-11-30' })).toBe('week');
  });
});

describe('toRows', () => {
  const breakdown = (rows: [string | null, string][]): CategoryBreakdown => ({
    currency: 'USD',
    starts_on: '2026-10-01',
    ends_on: '2026-10-31',
    categories: rows.map(([id, spent]) => ({
      category_id: id,
      name: id ?? 'Uncategorised',
      colour: '#e5e7eb',
      spent,
    })),
  });

  it('joins both periods, biggest now first, and draws the bucket in the shared neutral', () => {
    const rows = toRows(
      breakdown([['a', '10']]),
      breakdown([
        [null, '30'],
        ['a', '5'],
      ])
    );
    expect(rows.map((r) => [r.key, r.previousSpent, r.currentSpent])).toEqual([
      ['uncategorised', '0', '30'],
      ['a', '10', '5'],
    ]);
    expect(rows[0].colour).toBe(NEUTRAL_COLOUR);
  });

  it('folds a tail of two or more into "Others (n)", summed exactly', () => {
    const current = breakdown([
      ['a', '50'],
      ['b', '40'],
      ['c', '30'],
      ['d', '20'],
      ['e', '0.1'],
      ['f', '0.2'],
    ]);
    const rows = toRows(null, current);
    expect(rows).toHaveLength(5);
    expect(rows[4]).toMatchObject({
      name: 'Others (2)',
      colour: OTHERS_COLOUR,
      currentSpent: '0.3',
    });
  });

  it('keeps a single leftover row by name', () => {
    const current = breakdown([
      ['a', '5'],
      ['b', '4'],
      ['c', '3'],
      ['d', '2'],
      ['e', '1'],
    ]);
    expect(toRows(null, current).map((r) => r.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('share', () => {
  it('rounds to a whole percent and is 0 when nothing was spent', () => {
    expect(share('1', '3')).toBe(33);
    expect(share('5', '0')).toBe(0);
  });
});
