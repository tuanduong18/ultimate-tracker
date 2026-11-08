import {
  barPercent,
  isOverspent,
  scheduleOf,
  tintOrder,
  warnOptions,
  withoutSign,
} from '@/lib/finance/budgets';

describe('the progress bar', () => {
  it('fills by share of the cap, from empty to full and no further', () => {
    expect(barPercent('25.00', '100.00')).toBe(25);
    expect(barPercent('150.00', '100.00')).toBe(100);
    expect(barPercent('0', '100.00')).toBe(0);
  });

  it('draws nothing for a cap it cannot measure', () => {
    expect(barPercent('10', '0')).toBe(0);
    expect(barPercent('oops', '100')).toBe(0);
  });

  it('knows an overspent budget by its negative remainder, shown without the sign', () => {
    expect(isOverspent({ remaining: '-12.50' })).toBe(true);
    expect(isOverspent({ remaining: '0.00' })).toBe(false);
    expect(withoutSign('-12.50')).toBe('12.50');
    expect(withoutSign('12.50')).toBe('12.50');
  });
});

describe('scheduleOf', () => {
  it('gives a custom budget its dates and a monthly one its months', () => {
    expect(
      scheduleOf({ period: 'custom', starts_on: '2026-10-01', ends_on: '2026-10-31' })
    ).toMatch(/2026 – .*2026/);
    expect(scheduleOf({ period: 'monthly', starts_on: '2026-10-01', ends_on: null })).toMatch(
      /^Since /
    );
    expect(
      scheduleOf({ period: 'monthly', starts_on: '2026-10-01', ends_on: '2026-12-31' })
    ).not.toMatch(/^Since/);
  });
});

describe('warnOptions', () => {
  it('offers the usual four, and keeps a value set elsewhere in order', () => {
    expect(warnOptions(80)).toEqual([50, 75, 80, 90]);
    expect(warnOptions(null)).toEqual([50, 75, 80, 90]);
    expect(warnOptions(60)).toEqual([50, 60, 75, 80, 90]);
  });
});

describe('tintOrder', () => {
  it('colours by creation order, not list order, wrapping past the pastels', () => {
    const order = tintOrder(
      [
        { id: 'new', created_at: '2026-11-02T00:00:00Z' },
        { id: 'old', created_at: '2026-01-01T00:00:00Z' },
        { id: 'mid', created_at: '2026-06-01T00:00:00Z' },
      ],
      2
    );
    expect([order.get('old'), order.get('mid'), order.get('new')]).toEqual([0, 1, 0]);
  });
});
