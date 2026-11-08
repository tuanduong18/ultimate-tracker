import {
  CATEGORY_COLOURS,
  colourName,
  DEFAULT_CATEGORY_COLOUR,
} from '@/lib/finance/category-colours';
import { contrastRatio, inkOn } from '@/lib/tint';

describe('the category palette', () => {
  it('holds every starter category’s colour and every colour the web gives an import', () => {
    const palette = CATEGORY_COLOURS.map((colour) => colour.hex);
    for (const hex of [
      '#22c55e',
      '#ef4444',
      '#3b82f6',
      '#a855f7',
      '#f59e0b',
      '#94a3b8',
      '#06b6d4',
      '#ec4899',
      '#84cc16',
      '#f97316',
      '#6366f1',
      '#14b8a6',
      '#eab308',
      '#8b5cf6',
    ]) {
      expect(palette).toContain(hex);
    }
    expect(new Set(palette).size).toBe(palette.length);
  });

  it('keeps a badge’s glyph readable on every swatch', () => {
    for (const { hex } of CATEGORY_COLOURS) {
      expect(contrastRatio(hex, inkOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('names each swatch for TalkBack, in any case, and nothing off the palette', () => {
    expect(colourName('#22C55E')).toBe('Green');
    expect(colourName(DEFAULT_CATEGORY_COLOUR)).toBe('Slate');
    expect(colourName('#123456')).toBeNull();
  });
});
