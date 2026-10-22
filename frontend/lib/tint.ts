/**
 * Data colours: what a category or a budget looks like.
 *
 * A category's colour follows its spend everywhere — a slice in the ring, the
 * edge of a row in the list (CategoryEdge), a dot in the filter — so the same
 * spend is the same colour wherever it appears. Rows are no longer washed in
 * it: see CategoryEdge for why.
 */

/** The neutral used when nothing has a colour, matching the API's own default. */
export const NEUTRAL_COLOUR = '#94a3b8';

/**
 * `#rrggbb` at some opacity.
 *
 * Colours are `^#[0-9a-fA-F]{6}$`, enforced by the API, so anything else here
 * came from a bug rather than from a user and is better invisible than wrong.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 'transparent';
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
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
