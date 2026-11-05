import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

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
 * The choice lives in memory for now: the Settings screen, which brings the scheme and mode
 * pickers, also brings remembering them, read before the splash screen hides so a stored dark
 * mode never flashes light.
 */
export function AppThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
  initialMode = DEFAULT_MODE,
}: {
  children: ReactNode;
  initialTheme?: ThemeId;
  initialMode?: ModePreference;
}) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [modePreference, setModePreference] = useState<ModePreference>(initialMode);
  const mode = resolveMode(modePreference, systemScheme);

  const value = useMemo<AppTheme>(
    () => ({
      theme,
      modePreference,
      mode,
      colors: resolveColors(theme, mode),
      setTheme,
      setModePreference,
    }),
    [theme, modePreference, mode]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return theme;
}
