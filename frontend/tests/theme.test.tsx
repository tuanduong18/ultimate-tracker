import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemePicker } from '@/components/settings/theme-picker';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, readStoredTheme } from '@/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
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

describe('ThemePicker', () => {
  function renderPicker() {
    return render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>
    );
  }

  it('ticks the stored theme on load', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'pastel-lilac');
    renderPicker();

    await waitFor(() => expect(screen.getByRole('radio', { name: /Pastel lilac/ })).toBeChecked());
  });

  it('applies a choice to the document and remembers it', async () => {
    renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: /Pastel peach/ }));

    // The attribute is what actually recolours the app — the CSS keys off it.
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('pastel-peach'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('pastel-peach');
  });

  it('offers every theme exactly once', () => {
    renderPicker();

    expect(screen.getAllByRole('radio')).toHaveLength(THEMES.length);
  });

  it('still switches when the choice cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: /Classic slate/ }));

    // Unsaveable is not unusable: it applies now and is forgotten on reload.
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('slate'));
  });
});
