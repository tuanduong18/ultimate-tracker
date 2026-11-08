/**
 * Date helpers for the finance screens — the phone's copy of frontend/lib/dates.ts.
 *
 * Everything here works in the *phone's* local calendar, not UTC: `new Date().toISOString()` is
 * a day out for anyone west of Greenwich after their afternoon, which is exactly when someone
 * logs an expense. Dates are always built from their parts, never with Date.parse, which reads
 * a bare "2026-08-01" as UTC midnight and shows it as 31 July in any negative offset.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** A Date as the YYYY-MM-DD the API expects. */
export function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** A YYYY-MM-DD as a local Date, or null if it is not one. */
export function fromIso(iso: string): Date | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** An inclusive date range, both ends as the YYYY-MM-DD the API expects. */
export interface DateRange {
  start: string;
  end: string;
}

/** First and last day of the month containing `on` — inclusive, as the API reads them. */
export function monthRange(on: Date = new Date()): DateRange {
  const year = on.getFullYear();
  const month = on.getMonth();
  // Day 0 of the next month is the last day of this one, leap years included.
  return {
    start: toIsoDate(new Date(year, month, 1)),
    end: toIsoDate(new Date(year, month + 1, 0)),
  };
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** One formatter per shape, made on first use — building one is the slow part. */
function dateFormat(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, options);
    formats.set(key, format);
  }
  return format;
}

const FULL: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

/**
 * Two dates as one span, as Intl writes it ("3 – 9 Aug") when it can.
 *
 * Hermes, the phone's JavaScript engine, may not have `formatRange`; then both ends are
 * written in full ("3 Aug – 9 Aug"), which is longer but never wrong. Exported for its test.
 */
export function joinRange(format: Intl.DateTimeFormat, start: Date, end: Date): string {
  if (typeof format.formatRange === 'function') return format.formatRange(start, end);
  return `${format.format(start)} – ${format.format(end)}`;
}

/** "12 Aug 2026" — dates in a list, where the year matters but the weekday does not. */
export function formatDate(iso: string): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return dateFormat('full', FULL).format(parsed);
}

/**
 * "Aug 3 – 9" — the span one bar of the spending chart covers. The first and last bar of a range
 * are clipped by its ends, so labelling each with its own span stops a two-day bar reading as a
 * quiet week.
 */
export function formatSpan(startIso: string, endIso: string): string {
  const start = fromIso(startIso);
  const end = fromIso(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;
  const dayMonth = dateFormat('dayMonth', DAY_MONTH);
  if (startIso === endIso) return dayMonth.format(start);
  return joinRange(dayMonth, start, end);
}

/** "Aug 1 – 31, 2026" — the window a chart is showing; unlike `formatSpan`, with the year. */
export function formatRange(range: DateRange): string {
  const start = fromIso(range.start);
  const end = fromIso(range.end);
  if (!start || !end) return `${range.start} – ${range.end}`;
  const full = dateFormat('full', FULL);
  if (range.start === range.end) return full.format(start);
  return joinRange(full, start, end);
}

/** Monday to Sunday around `on` — the week as most calendars draw it. */
export function weekRange(on: Date = new Date()): DateRange {
  const monday = new Date(on.getFullYear(), on.getMonth(), on.getDate() - ((on.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: toIsoDate(monday), end: toIsoDate(sunday) };
}

/** Days a range covers, counting both ends — so a single day is 1, not 0. */
export function rangeLength(range: DateRange): number {
  const start = fromIso(range.start);
  const end = fromIso(range.end);
  if (!start || !end) return 1;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Step a range forward or back: by whole months when it is made of whole calendar months, by
 * its own length otherwise. The month before 1–31 October is 1–30 September, not the 31 days
 * before it; 10–12 Aug steps to 13–15 Aug.
 */
export function shiftRange(range: DateRange, direction: 1 | -1): DateRange {
  const start = fromIso(range.start);
  const end = fromIso(range.end);
  if (!start || !end) return range;

  const lastOfEndMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  if (start.getDate() === 1 && end.getDate() === lastOfEndMonth) {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
    const step = months * direction;
    return {
      start: toIsoDate(new Date(start.getFullYear(), start.getMonth() + step, 1)),
      end: toIsoDate(new Date(end.getFullYear(), end.getMonth() + step + 1, 0)),
    };
  }

  const days = rangeLength(range) * direction;
  const moved = (value: Date) =>
    toIsoDate(new Date(value.getFullYear(), value.getMonth(), value.getDate() + days));
  return { start: moved(start), end: moved(end) };
}

/**
 * Whole days from `from` to `to`: 0 for the same day, negative when `to` is earlier. For
 * "renews in 2 days", never for anything that sums money.
 */
export function daysUntil(to: string, from: string = todayIso()): number {
  return rangeLength({ start: from, end: to }) - 1;
}

/**
 * The same stretch of last month that `on`'s month has reached so far: 18 Oct → 1–18 Sep,
 * clipped to the shorter month (31 Mar → 1–28 Feb). Setting 18 days of October against all of
 * September would make every month look thrifty until its last week.
 */
export function sameDaysLastMonth(on: Date = new Date()): DateRange {
  const start = new Date(on.getFullYear(), on.getMonth() - 1, 1);
  const lastDay = new Date(on.getFullYear(), on.getMonth(), 0).getDate();
  const end = new Date(start.getFullYear(), start.getMonth(), Math.min(on.getDate(), lastDay));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** The first of the month containing `iso` (or today): "2026-10-18" → "2026-10-01". */
export function monthStart(iso: string = todayIso()): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The last day of the month containing `iso`: "2026-02-10" → "2026-02-28". */
export function monthEnd(iso: string): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return toIsoDate(new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0));
}

/** Move a month-start date by whole months: ("2026-10-01", -1) → "2026-09-01". */
export function shiftMonth(iso: string, by: number): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return toIsoDate(new Date(parsed.getFullYear(), parsed.getMonth() + by, 1));
}

/** "October 2026" — the month a budget screen is showing. */
export function formatMonth(iso: string): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return dateFormat('month', { month: 'long', year: 'numeric' }).format(parsed);
}

/** "Oct 2026" — a month inside a sentence, where the long form is too heavy. */
export function formatMonthShort(iso: string): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return dateFormat('monthShort', { month: 'short', year: 'numeric' }).format(parsed);
}

/** True when a range is exactly one calendar month, the 1st to its last day. */
export function isCalendarMonth(range: DateRange): boolean {
  const start = fromIso(range.start);
  if (!start || start.getDate() !== 1) return false;
  return monthEnd(range.start) === range.end;
}

/** True when a range is exactly one Monday-to-Sunday week. */
export function isCalendarWeek(range: DateRange): boolean {
  const start = fromIso(range.start);
  // getDay() is 1 for Monday; seven days inclusive ends on the Sunday.
  return start !== null && start.getDay() === 1 && rangeLength(range) === 7;
}
