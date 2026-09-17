/**
 * Date helpers for the finance UI.
 *
 * Everything here works in the *browser's* local calendar, not UTC and not the
 * profile timezone. `new Date().toISOString()` is a day out for anyone west of
 * Greenwich after their afternoon, which is exactly when someone logs an
 * expense. Reconciling with the profile timezone is a later problem; getting
 * "today" wrong for half the world is a now problem.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Format a Date as the YYYY-MM-DD the API expects. */
export function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** First and last day of the month containing `on` — inclusive, as the API reads them. */
export function monthRange(on: Date = new Date()): { start: string; end: string } {
  const year = on.getFullYear();
  const month = on.getMonth();
  // Day 0 of the next month is the last day of this one, leap years included.
  return {
    start: toIsoDate(new Date(year, month, 1)),
    end: toIsoDate(new Date(year, month + 1, 0)),
  };
}

/** "August 2026" — the label over the summary tiles. */
export function monthLabel(on: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(on);
}

/**
 * Parse a YYYY-MM-DD into a local Date, or null if it is not one.
 *
 * Built from parts rather than Date.parse(iso), which reads a bare date as UTC
 * midnight and then renders it as the previous day for anyone west of Greenwich.
 */
function fromIso(iso: string): Date | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** "12 Aug 2026" — dates in a list, where the year matters but the weekday does not. */
export function formatDate(iso: string): string {
  const parsed = fromIso(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

/**
 * "Aug 3 – 9" — the span one bar of the weekly chart covers.
 *
 * The first and last bar of a month are clipped by its ends, so bars are not all
 * the same width in days. Labelling each with its actual span is what stops a
 * two-day bar from reading as a quiet week.
 *
 * Formatted by Intl rather than by hand. Intl knows to write "Aug 3 – 9" where
 * hand-assembling the parts produced "3 – Aug 9" in any locale that puts the
 * month first, which is most of them.
 */
export function formatSpan(startIso: string, endIso: string): string {
  const start = fromIso(startIso);
  const end = fromIso(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;

  const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  if (startIso === endIso) return dayMonth.format(start);
  return dayMonth.formatRange(start, end);
}

/** An inclusive date range, both ends as the YYYY-MM-DD the API expects. */
export interface DateRange {
  start: string;
  end: string;
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
 * Step a range forward or back by its own length.
 *
 * Deliberately not "the next calendar month": a range picked by hand has no
 * calendar unit to advance by, and one rule that works for every range beats a
 * rule that only works for the two presets. The cost is that stepping on from
 * a 30-day September lands on 1–30 October rather than 1–31 — pick the preset
 * again to resynchronise with the calendar.
 */
export function shiftRange(range: DateRange, direction: 1 | -1): DateRange {
  const start = fromIso(range.start);
  const end = fromIso(range.end);
  if (!start || !end) return range;

  const days = rangeLength(range) * direction;
  const moved = (value: Date) =>
    toIsoDate(new Date(value.getFullYear(), value.getMonth(), value.getDate() + days));
  return { start: moved(start), end: moved(end) };
}

/**
 * "Aug 1 – 31, 2026" — the window a chart is showing.
 *
 * Unlike formatSpan, which labels one bar inside a known window, this is the
 * only place the window itself is named, so it always carries the year.
 */
export function formatRange(range: DateRange): string {
  const start = fromIso(range.start);
  const end = fromIso(range.end);
  if (!start || !end) return `${range.start} – ${range.end}`;

  const full = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (range.start === range.end) return full.format(start);
  return full.formatRange(start, end);
}
