import { NEUTRAL_COLOUR, withAlpha } from '@/lib/tint';

/** The first letter or digit of a name, upper-cased — "?" when it has none. */
export function initialOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
}

/**
 * A row's leading badge: an initial on a light wash of the category's colour,
 * like an app icon on a bank statement — the quickest way down a list is by
 * shape and colour, before reading. Subscriptions show the service's initial
 * ("N" for Netflix); expenses show the category's ("F" for Food).
 *
 * The wash is 28% of the category colour with `fg` text, the one strength
 * measured readable (≥ 6:1) for any colour a user can pick, black and white
 * included. The row names its category in words too, so the colour never
 * carries meaning alone — which is why the badge is hidden from screen readers.
 *
 * Replaced the 4px `CategoryEdge` on expense rows (2026-11-06): a sliver down
 * the edge was too thin to skim a column of expenses by.
 */
export function CategoryBadge({
  colour,
  name,
}: {
  colour: string | null | undefined;
  /** What the initial is taken from: the service, or the category. */
  name: string;
}) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
      style={{ backgroundColor: withAlpha(colour ?? NEUTRAL_COLOUR, 0.28) }}
    >
      {initialOf(name)}
    </span>
  );
}
