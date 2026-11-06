import { inkOn, NEUTRAL_COLOUR } from '@/lib/tint';

/** The first letter or digit of a name, upper-cased — "?" when it has none. */
export function initialOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
}

/**
 * A row's leading badge: the category's own colour, with an initial on it, like
 * an app icon on a bank statement — the quickest way down a list is by shape
 * and colour, before reading. Subscriptions show the service's initial ("N" for
 * Netflix); expenses and categories show the category's ("F" for Food).
 *
 * **The colour is the category's, solid, in both modes** — the same colour as
 * its slice in the chart and its dot in the filter. (It was a 28% wash at
 * first, which came out pale on light and muddy on dark and so never matched
 * the chart; the user caught it, 2026-11-06.) The initial takes white or black
 * by `inkOn`, whichever contrasts more, which reaches 4.58:1 or better on any
 * colour a user can pick.
 *
 * The row names its category in words too, so the colour never carries meaning
 * alone — which is why the badge is hidden from screen readers.
 */
export function CategoryBadge({
  colour,
  name,
}: {
  colour: string | null | undefined;
  /** What the initial is taken from: the service, or the category. */
  name: string;
}) {
  const background = colour ?? NEUTRAL_COLOUR;
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
      style={{ backgroundColor: background, color: inkOn(background) }}
    >
      {initialOf(name)}
    </span>
  );
}
