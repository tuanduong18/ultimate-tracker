/**
 * The colours a category can be given on the phone, in hue order: the starter set's six and the
 * eight the web hands out to imported categories, plus a sky and a stone to close the gaps in
 * the wheel. Data colours, like lib/tint.ts — what the person's category looks like, the same in
 * light and dark — so they live here rather than in the theme.
 *
 * A palette rather than the web's free picker: Android has no native colour picker, and a
 * drawn hue wheel is a fiddly target on a phone, where sixteen swatches cover every hue a person
 * tells apart at badge size. A colour picked on the web that isn't here is kept (the form shows
 * it as "Current colour"), so editing never repaints a category behind the person's back.
 * `inkOn` keeps the badge's glyph readable on every one of them.
 */
export const CATEGORY_COLOURS = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#0ea5e9', name: 'Sky' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#78716c', name: 'Stone' },
  { hex: '#94a3b8', name: 'Slate' },
] as const;

/** The API's default and a new category's starting colour: Slate, the shared neutral. */
export const DEFAULT_CATEGORY_COLOUR = '#94a3b8';

/** A swatch's name for TalkBack, or null for a colour that isn't on the palette. */
export function colourName(hex: string): string | null {
  const lower = hex.toLowerCase();
  return CATEGORY_COLOURS.find((colour) => colour.hex === lower)?.name ?? null;
}
