import {
  daysUntil,
  formatDate,
  formatMonth,
  formatSpan,
  isCalendarMonth,
  isCalendarWeek,
  joinRange,
  monthEnd,
  monthRange,
  monthStart,
  rangeLength,
  sameDaysLastMonth,
  shiftMonth,
  shiftRange,
  toIsoDate,
  todayIso,
  weekRange,
} from '@/lib/dates';

describe('the local calendar', () => {
  it('writes a date from its local parts, not UTC', () => {
    // toISOString() would make this 2026-08-11 for anyone west of Greenwich.
    expect(toIsoDate(new Date(2026, 7, 12, 23, 30))).toBe('2026-08-12');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('agrees with the phone about today', () => {
    expect(todayIso()).toBe(toIsoDate(new Date()));
  });

  it('ends a month on its real last day, leap years included', () => {
    expect(monthRange(new Date(2024, 1, 15))).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthRange(new Date(2026, 1, 15))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthEnd('2026-02-10')).toBe('2026-02-28');
  });
});

describe('formatting', () => {
  it('shows an API date without slipping to the day before', () => {
    const shown = formatDate('2026-08-01');
    expect(shown).toMatch(/2026/);
    expect(shown).not.toMatch(/31/);
  });

  it('hands back anything it cannot parse unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatSpan('not-a-date', '2026-08-09')).toContain('not-a-date');
  });

  it('names a week span once when both ends share a month', () => {
    const span = formatSpan('2026-08-03', '2026-08-09');
    expect(span.match(/Aug/g)).toHaveLength(1);
  });

  it('collapses a one-day span to a single date', () => {
    const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
    expect(formatSpan('2026-08-31', '2026-08-31')).toBe(dayMonth.format(new Date(2026, 7, 31)));
  });

  it('writes both ends in full where the engine has no formatRange', () => {
    // Hermes may lack it; the span must still read correctly, if longer.
    const plain = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
    const withoutRange = { format: (d: Date) => plain.format(d) } as Intl.DateTimeFormat;
    expect(joinRange(withoutRange, new Date(2026, 7, 3), new Date(2026, 7, 9))).toBe(
      '3 Aug – 9 Aug'
    );
  });

  it('names a month with its year', () => {
    expect(formatMonth('2026-10-01')).toMatch(/2026/);
  });
});

describe('ranges', () => {
  it('runs a week from Monday to Sunday', () => {
    // 7 Nov 2026 is a Saturday.
    expect(weekRange(new Date(2026, 10, 7))).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(isCalendarWeek({ start: '2026-11-02', end: '2026-11-08' })).toBe(true);
    expect(isCalendarWeek({ start: '2026-11-03', end: '2026-11-09' })).toBe(false);
  });

  it('counts both ends of a range', () => {
    expect(rangeLength({ start: '2026-08-01', end: '2026-08-01' })).toBe(1);
    expect(rangeLength({ start: '2026-08-01', end: '2026-08-31' })).toBe(31);
    expect(daysUntil('2026-08-03', '2026-08-01')).toBe(2);
    expect(daysUntil('2026-07-30', '2026-08-01')).toBe(-2);
  });

  it('recognises a whole calendar month', () => {
    expect(isCalendarMonth({ start: '2026-02-01', end: '2026-02-28' })).toBe(true);
    expect(isCalendarMonth({ start: '2026-02-01', end: '2026-02-27' })).toBe(false);
  });

  it('steps a whole month to the previous calendar month, not its length in days', () => {
    expect(shiftRange({ start: '2026-10-01', end: '2026-10-31' }, -1)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
    expect(shiftRange({ start: '2028-03-01', end: '2028-03-31' }, -1)).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('steps a run of whole months by the same number of months, across a year', () => {
    expect(shiftRange({ start: '2026-07-01', end: '2026-09-30' }, -1)).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(shiftRange({ start: '2027-01-01', end: '2027-01-31' }, -1)).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
  });

  it('moves anything that is not whole months by its own length', () => {
    expect(shiftRange({ start: '2026-08-10', end: '2026-08-12' }, 1)).toEqual({
      start: '2026-08-13',
      end: '2026-08-15',
    });
    expect(shiftRange({ start: '2026-10-12', end: '2026-10-18' }, -1)).toEqual({
      start: '2026-10-05',
      end: '2026-10-11',
    });
  });

  it('compares a month so far with the same days of the month before', () => {
    expect(sameDaysLastMonth(new Date(2026, 9, 18))).toEqual({
      start: '2026-09-01',
      end: '2026-09-18',
    });
    expect(sameDaysLastMonth(new Date(2026, 2, 31))).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(sameDaysLastMonth(new Date(2027, 0, 5))).toEqual({
      start: '2026-12-01',
      end: '2026-12-05',
    });
  });
});

describe('months', () => {
  it('finds the first of the month and steps by whole months', () => {
    expect(monthStart('2026-10-18')).toBe('2026-10-01');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
  });
});
