import { symbolFor } from '@/lib/category-symbols';
import { inkOn, NEUTRAL_COLOUR } from '@/lib/tint';

/** The first letter or digit of a name, upper-cased — "?" when it has none. */
export function initialOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
}

/**
 * A row's leading badge: the category's own colour with its symbol on it, like
 * an app icon on a bank statement — the quickest way down a list is by shape
 * and colour, before reading.
 *
 * **The symbol** is the category's, when it has one (Food → a fork and knife).
 * Without one — or with a key this app doesn't know yet — it falls back to an
 * initial. Subscriptions pass no `icon` on purpose: their badge shows the
 * service's initial ("N" for Netflix), which tells one subscription from
 * another, where the shared "Subscriptions" symbol would make every badge alike.
 *
 * **The colour is the category's, solid, in both modes** — the same colour as
 * its slice in the chart and its dot in the filter. (It was a 28% wash at
 * first, which came out pale on light and muddy on dark and so never matched
 * the chart; the user caught it, 2026-11-06.) The glyph takes white or black by
 * `inkOn`, whichever contrasts more, which reaches 4.58:1 or better on any
 * colour a user can pick.
 *
 * The row names its category in words too, so neither colour nor symbol carries
 * meaning alone — which is why the badge is hidden from screen readers.
 */
export function CategoryBadge({
  colour,
  name,
  icon,
}: {
  colour: string | null | undefined;
  /** What the fallback initial is taken from: the service, or the category. */
  name: string;
  /** The category's symbol key, if any. */
  icon?: string | null;
}) {
  const background = colour ?? NEUTRAL_COLOUR;
  const symbol = symbolFor(icon);
  return (
    <span
      aria-hidden
      data-symbol={symbol?.key}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
      style={{ backgroundColor: background, color: inkOn(background) }}
    >
      {symbol ? <symbol.Icon className="size-5" strokeWidth={2} /> : initialOf(name)}
    </span>
  );
}
