import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemePicker } from '@/components/settings/theme-picker';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { THEMES, THEME_STORAGE_KEY } from '@/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
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
