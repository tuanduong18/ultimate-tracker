import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, readStoredTheme } from '@/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('theme storage', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('ignores a stored value that is not a theme', () => {
    // A stale id from an older build, or someone editing localStorage by hand.
    // Trusting it would set data-theme to something no CSS block matches.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('survives storage being unavailable', () => {
    // Safari in private mode throws on getItem rather than returning null, and
    // a colour preference is not worth taking the page down over.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('accepts every id the picker can produce', () => {
    for (const theme of THEMES) {
      expect(isThemeId(theme.id)).toBe(true);
    }
  });
});
