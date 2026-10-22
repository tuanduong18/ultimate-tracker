import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemePicker } from '@/components/settings/theme-picker';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { MODES, MODE_STORAGE_KEY, THEMES, THEME_STORAGE_KEY } from '@/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.mode;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A stand-in for the OS colour scheme that a test can flip mid-render. */
function stubSystemDark(initial: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query)
  );
  return (dark: boolean) => {
    query.matches = dark;
    listeners.forEach((listener) => listener());
  };
}

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

    await waitFor(() => expect(screen.getByRole('radio', { name: /^Violet/ })).toBeChecked());
  });

  it('applies a choice to the document and remembers it', async () => {
    renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: /^Terracotta/ }));

    // The attribute is what actually recolours the app — the CSS keys off it.
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('pastel-peach'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('pastel-peach');
  });

  it('offers every scheme and every mode exactly once', () => {
    renderPicker();

    const schemes = screen.getByRole('group', { name: 'Colour scheme' });
    const modes = screen.getByRole('group', { name: 'Appearance' });
    expect(within(schemes).getAllByRole('radio')).toHaveLength(THEMES.length);
    expect(within(modes).getAllByRole('radio')).toHaveLength(MODES.length);
  });

  it('applies dark mode to the document and remembers it', async () => {
    stubSystemDark(false);
    renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement.dataset.mode).toBe('dark'));
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
  });

  it('follows the device by default, live, until told otherwise', async () => {
    const setSystemDark = stubSystemDark(true);
    renderPicker();

    expect(screen.getByRole('radio', { name: 'Match system' })).toBeChecked();
    await waitFor(() => expect(document.documentElement.dataset.mode).toBe('dark'));

    // The OS flips at sunrise: an open tab follows without a reload.
    setSystemDark(false);
    await waitFor(() => expect(document.documentElement.dataset.mode).toBe('light'));

    // An explicit choice stops it following.
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    setSystemDark(false);
    await waitFor(() => expect(document.documentElement.dataset.mode).toBe('dark'));
  });

  it('keeps the scheme when the mode changes', async () => {
    stubSystemDark(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'pastel-rose');
    renderPicker();

    await waitFor(() => expect(screen.getByRole('radio', { name: /^Rose/ })).toBeChecked());
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement.dataset.mode).toBe('dark'));
    expect(screen.getByRole('radio', { name: /^Rose/ })).toBeChecked();
  });

  it('still switches when the choice cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: /^Graphite/ }));

    // Unsaveable is not unusable: it applies now and is forgotten on reload.
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('slate'));
  });
});
