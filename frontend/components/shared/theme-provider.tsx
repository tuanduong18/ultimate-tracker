'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  DARK_QUERY,
  DEFAULT_MODE,
  DEFAULT_THEME,
  readStoredMode,
  readStoredTheme,
  resolveMode,
  storeMode,
  storeTheme,
  type ModePreference,
  type ResolvedMode,
  type ThemeId,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  /** What was chosen, including "system". */
  mode: ModePreference;
  setMode: (mode: ModePreference) => void;
  /** What is actually painted right now. */
  resolvedMode: ResolvedMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the current theme and mode and writes them to the document element.
 *
 * The palettes are CSS, so this does not need to re-render anything to change
 * colours — setting `data-theme` / `data-mode` is enough, and the browser
 * repaints. React state exists only so the picker can show which is ticked.
 *
 * Initial state is the default rather than the stored value, because this runs
 * on the server too and localStorage does not exist there. The effect corrects
 * it on mount; ThemeScript has already set the attributes before first paint,
 * so that correction is invisible.
 *
 * While the mode is "system" this also follows the OS live: switching the
 * desktop to dark at sunset turns the open tab dark too, without a reload.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ModePreference>(DEFAULT_MODE);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>('light');

  useEffect(() => {
    setThemeState(readStoredTheme());
    setModeState(readStoredMode());
  }, []);

  // Paint the resolved mode, and keep resolving it while it follows the OS.
  useEffect(() => {
    const apply = () => {
      const next = resolveMode(mode);
      document.documentElement.dataset.mode = next;
      setResolvedMode(next);
    };
    apply();
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [mode]);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    storeTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const setMode = useCallback((next: ModePreference) => {
    setModeState(next);
    storeMode(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
