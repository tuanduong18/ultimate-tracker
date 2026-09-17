'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_THEME, readStoredTheme, storeTheme, type ThemeId } from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the current theme and writes it to the document element.
 *
 * The palettes are CSS, so this does not need to re-render anything to change
 * colours — setting `data-theme` is enough, and the browser repaints. React
 * state exists only so the picker can show which one is ticked.
 *
 * Initial state is the default rather than the stored value, because this runs
 * on the server too and localStorage does not exist there. The effect corrects
 * it on mount; ThemeScript has already set the attribute before first paint, so
 * that correction is invisible.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    storeTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
