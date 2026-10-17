import { describe, expect, it } from 'vitest';

import { formatDate, formatSpan, monthRange, toIsoDate, todayIso } from '@/lib/dates';

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
  it('names a week span once when both ends share a month', () => {
    const span = formatSpan('2026-08-03', '2026-08-09');
    expect(span).toMatch(/3/);
    expect(span).toMatch(/9/);
    // "3-9 Aug", not "3 Aug - 9 Aug".
    expect(span.match(/Aug/g)).toHaveLength(1);
  });

  it('names both months when a week straddles them', () => {
    const span = formatSpan('2026-08-31', '2026-09-06');
    expect(span).toMatch(/Aug/);
    expect(span).toMatch(/Sep/);
  });

  it('collapses a one-day span to a single date', () => {
    // August 2026 ends on a Monday, so the last bar of that month is one day.
    // Built the same way rather than hard-coded, so the assertion holds in
    // whatever locale the test runner happens to be in.
    const dayMonth = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
    }).format(new Date(2026, 7, 31));

    expect(formatSpan('2026-08-31', '2026-08-31')).toBe(dayMonth);
  });

  it('hands back a span it cannot parse unchanged', () => {
    expect(formatSpan('not-a-date', '2026-08-09')).toContain('not-a-date');
  });
});
