/**
 * Data colours: what a category looks like — the phone's copy of frontend/lib/tint.ts.
 *
 * A category's colour follows its spend everywhere — its slice in the ring, the badge that leads
 * a row, its chip in a picker — and it is the same colour in light and dark, so the same spend is
 * the same colour wherever and whenever it appears. These are data, not theme: no token covers a
 * colour the user picked, which is why they live here and not in tokens.ts.
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
 * Category colours are the user's, so no fixed ink is readable on all of them, but one of pure
 * white and pure black always reaches at least 4.58:1 against any colour (the worst case is a
 * mid-grey, where the two tie) — WCAG AA for text. Pure, not the theme's near-white and
 * near-black: those dip under 4.5 at the tie. A colour that isn't `#rrggbb` gets dark ink.
 */
export function inkOn(hex: string): typeof INK_LIGHT | typeof INK_DARK {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return INK_DARK;
  return contrastRatio(hex, INK_LIGHT) >= contrastRatio(hex, INK_DARK) ? INK_LIGHT : INK_DARK;
}
