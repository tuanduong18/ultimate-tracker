import { ACCENTS, NEUTRAL } from '@/theme/tokens';
import { THEMES, resolveColors, resolveMode } from '@/theme/themes';

const HEX = /^#[0-9a-f]{6}$/;

describe('themes', () => {
  it('offers exactly the schemes the generator produced', () => {
    expect(THEMES.map((t) => t.id).sort()).toEqual(Object.keys(ACCENTS).sort());
  });

  it.each(THEMES.flatMap((t) => (['light', 'dark'] as const).map((mode) => [t.id, mode])))(
    '%s in %s mode resolves every token to a colour',
    (theme, mode) => {
      const colors = resolveColors(
        theme as (typeof THEMES)[number]['id'],
        mode as 'light' | 'dark'
      );
      const expected = [...Object.keys(NEUTRAL.light), 'primary', 'primaryFg', 'primarySoft'];
      expect(Object.keys(colors).sort()).toEqual(expected.sort());
      for (const value of Object.values(colors)) expect(value).toMatch(HEX);
    }
  );

  it('keeps the neutral base the same across schemes', () => {
    const blue = resolveColors('pastel-blue', 'dark');
    const rose = resolveColors('pastel-rose', 'dark');
    expect(blue.bg).toBe(rose.bg);
    expect(blue.primary).not.toBe(rose.primary);
  });
});

describe('resolveMode', () => {
  it('follows the phone when set to system', () => {
    expect(resolveMode('system', 'dark')).toBe('dark');
    expect(resolveMode('system', 'light')).toBe('light');
  });

  it('falls back to light when the phone gives no answer', () => {
    expect(resolveMode('system', null)).toBe('light');
    expect(resolveMode('system', 'unspecified')).toBe('light');
  });

  it('ignores the phone once a mode is chosen', () => {
    expect(resolveMode('light', 'dark')).toBe('light');
    expect(resolveMode('dark', 'light')).toBe('dark');
  });
});
