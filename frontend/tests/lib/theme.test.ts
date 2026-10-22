import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  THEMES,
  THEME_STORAGE_KEY,
  isThemeId,
  readStoredMode,
  readStoredTheme,
  resolveMode,
} from '@/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
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

describe('mode', () => {
  it('follows the system until someone chooses', () => {
    expect(readStoredMode()).toBe(DEFAULT_MODE);
    expect(DEFAULT_MODE).toBe('system');
  });

  it('ignores a stored value that is not a mode', () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dusk');
    expect(readStoredMode()).toBe(DEFAULT_MODE);
  });

  it('resolves "system" through the OS setting, and nothing else', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true }))
    );
    expect(resolveMode('system')).toBe('dark');
    expect(resolveMode('light')).toBe('light');
  });

  it('treats a browser without matchMedia as light', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveMode('system')).toBe('light');
  });

  it('has a light and a dark swatch for every scheme', () => {
    for (const theme of THEMES) {
      expect(theme.swatch.light).toHaveLength(2);
      expect(theme.swatch.dark).toHaveLength(2);
    }
  });
});
