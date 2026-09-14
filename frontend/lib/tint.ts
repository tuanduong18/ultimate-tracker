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
 * Pick the colour for a card covering several categories.
 *
 * Sorted by name rather than trusting the order a join table hands back, so a
 * budget does not change colour between two loads of the same page.
 */
export function tintOfMany(categories: { name: string; colour: string }[]): string {
  const [first] = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  return cardTint(first?.colour);
}
