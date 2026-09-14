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
 * "3–9 Aug" — the span one bar of the weekly chart covers.
 *
 * The first and last bar of a month are clipped by its ends, so bars are not all
 * the same width in days. Labelling each with its actual span is what stops a
 * two-day bar from reading as a quiet week.
 */
export function formatSpan(startIso: string, endIso: string): string {
  const start = fromIso(startIso);
  const end = fromIso(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;

  const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  if (startIso === endIso) return dayMonth.format(start);

  // Within one month the month name only needs saying once.
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const day = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
    return `${day.format(start)}–${dayMonth.format(end)}`;
  }
  return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}
