/**
 * Category colours, washed out enough to sit behind text.
 *
 * Expenses, budgets and categories are all drawn as cards tinted by the
 * category behind them, so the same spend is the same colour wherever it
 * appears — a slice in the pie, a row in the list, a bar's worth of budget.
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
 * The wash behind a card.
 *
 * Light enough that `fg` text over it keeps its contrast — the palettes are
 * checked at full strength, and a 14% tint moves them by less than the margin
 * they pass with.
 */
export function cardTint(colour: string | null | undefined): string {
  return withAlpha(colour ?? NEUTRAL_COLOUR, 0.14);
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
 * Light enough to put `fg` text on directly, so unlike category tints these
 * need no alpha. They are also fixed across themes: their whole job is to
 * differ from each other, which a palette derived from one theme's hue could
 * not do.
 */
export const BUDGET_TINTS = [
  '#e3effd', // blue
  '#fde8e8', // rose
  '#e6f4ea', // green
  '#f3e9fc', // lilac
  '#fdf0e0', // peach
  '#e0f4f4', // teal
  '#fdf6da', // butter
  '#fce9f3', // pink
] as const;

/**
 * The colour for the nth budget ever made.
 *
 * Wraps once there are more budgets than pastels; at that point two cards share
 * a colour, which is worse than it sounds only if they are adjacent, and better
 * than inventing shades nobody can tell apart.
 */
export function budgetTint(index: number): string {
  return BUDGET_TINTS[((index % BUDGET_TINTS.length) + BUDGET_TINTS.length) % BUDGET_TINTS.length];
}
