import { describe, expect, it } from 'vitest';

import { formatDate, monthRange, toIsoDate, todayIso } from '@/lib/dates';

describe('date helpers', () => {
  it('formats a date from its local parts, not UTC', () => {
    // toISOString() would make this 2026-08-11 for anyone west of Greenwich.
    expect(toIsoDate(new Date(2026, 7, 12, 23, 30))).toBe('2026-08-12');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('ends the month on its real last day, leap years included', () => {
    expect(monthRange(new Date(2024, 1, 15))).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthRange(new Date(2026, 1, 15))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange(new Date(2026, 11, 9))).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('renders an API date without slipping to the day before', () => {
    // new Date('2026-08-01') is UTC midnight, which renders as 31 July in any
    // negative offset. Constructing from parts is what avoids that.
    const rendered = formatDate('2026-08-01');
    expect(rendered).toMatch(/2026/);
    expect(rendered).not.toMatch(/31/);
  });

  it('hands back anything it cannot parse unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('agrees with the local calendar about today', () => {
    const now = new Date();
    expect(todayIso()).toBe(toIsoDate(now));
  });
});
