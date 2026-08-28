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

/** "12 Aug 2026" — dates in a list, where the year matters but the weekday does not. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  // Constructed from parts rather than Date.parse(iso), which reads a bare
  // YYYY-MM-DD as UTC midnight and then renders it as the previous day.
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}
