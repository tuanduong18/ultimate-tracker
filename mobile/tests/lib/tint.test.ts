import { contrastRatio, INK_DARK, INK_LIGHT, inkOn, NEUTRAL_COLOUR } from '@/lib/tint';

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('inkOn', () => {
  it('puts black on light colours and white on dark ones', () => {
    expect(inkOn('#facc15')).toBe(INK_DARK);
    expect(inkOn('#1e3a8a')).toBe(INK_LIGHT);
    expect(inkOn(NEUTRAL_COLOUR)).toBe(INK_DARK);
  });

  it('is readable as text on any colour a person can pick', () => {
    let worst = Infinity;
    for (let r = 0; r <= 255; r += 15)
      for (let g = 0; g <= 255; g += 15)
        for (let b = 0; b <= 255; b += 15) {
          const colour = hex(r, g, b);
          worst = Math.min(worst, contrastRatio(colour, inkOn(colour)));
        }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to dark ink for anything that is not #rrggbb', () => {
    expect(inkOn('red')).toBe(INK_DARK);
  });
});
