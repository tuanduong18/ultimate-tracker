/**
 * Data colours: what a category or a budget looks like.
 *
 * A category's colour follows its spend everywhere — a slice in the ring, the
 * badge at the start of a row (CategoryBadge), a dot in the filter — and it is
 * the same colour in light and dark mode, so the same spend is the same colour
 * wherever and whenever it appears.
 */

/** The neutral used when nothing has a colour, matching the API's own default. */
export const NEUTRAL_COLOUR = '#94a3b8';

/** The two inks a glyph can take on a category colour: they don't change with the mode. */
export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#000000';

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * What to draw on a category colour: white or black, whichever contrasts more.
 *
 * Category colours are the user's, so no fixed ink is readable on all of them —
 * that is why text used to stay off them. But one of pure white and pure black
 * always reaches at least 4.58:1 against any colour (the worst case is a
 * mid-grey, where the two tie), which passes WCAG AA for text. Pure, not the
 * theme's near-white and near-black: those lose enough at the tie to dip under
 * 4.5. A colour that isn't `#rrggbb` (a bug, not a user) gets dark ink.
 */
export function inkOn(hex: string): typeof INK_LIGHT | typeof INK_DARK {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return INK_DARK;
  return contrastRatio(hex, INK_LIGHT) >= contrastRatio(hex, INK_DARK) ? INK_LIGHT : INK_DARK;
}

/**
 * The pastels budget cards are drawn from, in the order they are handed out.
 *
 * Budgets have no colour of their own and nothing about them implies one — a
 * budget over Food and Rent is not either of those things. So the colour is
 * only ever a way to tell two cards apart, which makes a fixed rota the honest
 * mechanism: the nth budget takes the nth pastel and no two repeat until the
 * list wraps.
 *
 * Each is a utility class over a `--channel-budget-n` token, so the stylesheet
 * can give dark mode its own set: a pale pastel under light-mode text turns into
 * a glaring block under dark-mode text. `fg` sits on either set directly, so
 * unlike category tints these need no alpha. They are fixed across colour
 * schemes: their whole job is to differ from each other, which a palette
 * derived from one scheme's hue could not do.
 *
 * Written out in full rather than built from the index, because Tailwind only
 * generates classes it can find spelled out in the source.
 */
export const BUDGET_TINTS = [
  'bg-budget-1', // blue
  'bg-budget-2', // rose
  'bg-budget-3', // green
  'bg-budget-4', // lilac
  'bg-budget-5', // peach
  'bg-budget-6', // teal
  'bg-budget-7', // butter
  'bg-budget-8', // pink
] as const;

/**
 * The background class for the nth budget ever made.
 *
 * Wraps once there are more budgets than pastels; at that point two cards share
 * a colour, which is worse than it sounds only if they are adjacent, and better
 * than inventing shades nobody can tell apart.
 */
export function budgetTint(index: number): string {
  return BUDGET_TINTS[((index % BUDGET_TINTS.length) + BUDGET_TINTS.length) % BUDGET_TINTS.length];
}
