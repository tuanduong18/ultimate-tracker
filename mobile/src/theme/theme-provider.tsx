import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Appearance } from '@/theme/appearance-store';
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  resolveColors,
  resolveMode,
  type Colors,
  type ModePreference,
  type ResolvedMode,
  type ThemeId,
} from '@/theme/themes';

interface AppTheme {
  theme: ThemeId;
  modePreference: ModePreference;
  /** What `modePreference` resolves to right now; `system` follows the phone live. */
  mode: ResolvedMode;
  colors: Colors;
  setTheme: (theme: ThemeId) => void;
  setModePreference: (mode: ModePreference) => void;
}

const AppThemeContext = createContext<AppTheme | null>(null);

/**
 * Holds the scheme and mode, and hands every component the colours they resolve to.
 *
 * The web switches themes with an attribute on <html> and lets CSS repaint; React Native has
 * no cascade, so here the resolved colours travel by context and a change re-renders what
 * reads them. Components read `colors` and never branch on the mode — a component that seems
 * to need to know the mode is missing a token.
 *
 * The provider only holds the choice. The root layout reads the stored one before the splash
 * screen hides (so a stored dark mode never flashes light) and passes it in as the initial
 * value, with `onChange` to remember each new choice — tests leave both out.
 */
export function AppThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
  initialMode = DEFAULT_MODE,
  onChange,
}: {
  children: ReactNode;
  initialTheme?: ThemeId;
  initialMode?: ModePreference;
  onChange?: (appearance: Appearance) => void;
}) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);
  const [modePreference, setModeState] = useState<ModePreference>(initialMode);
  const mode = resolveMode(modePreference, systemScheme);

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      onChange?.({ theme: next, mode: modePreference });
    },
    [modePreference, onChange]
  );

  const setModePreference = useCallback(
    (next: ModePreference) => {
      setModeState(next);
      onChange?.({ theme, mode: next });
    },
    [theme, onChange]
  );

  const value = useMemo<AppTheme>(
    () => ({
      theme,
      modePreference,
      mode,
      colors: resolveColors(theme, mode),
      setTheme,
      setModePreference,
    }),
    [theme, modePreference, mode, setTheme, setModePreference]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return theme;
}
