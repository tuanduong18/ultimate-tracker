import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance as SystemAppearance, useColorScheme } from 'react-native';

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
import { BUDGET_TINTS } from '@/theme/tokens';

interface AppTheme {
  theme: ThemeId;
  modePreference: ModePreference;
  /** What `modePreference` resolves to right now; `system` follows the phone live. */
  mode: ResolvedMode;
  colors: Colors;
  /**
   * The budget cards' pastels for the mode, handed out by creation order — part of the theme so
   * a card never has to ask which mode it is in. The same in every scheme: their job is to differ
   * from each other, which tints of one scheme's hue couldn't.
   */
  budgetTints: readonly string[];
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

  // Android draws some parts itself — the date picker, confirmation dialogs — from the native
  // theme, which is DayNight (plugins/with-android-theme.js). Telling it the chosen mode keeps
  // those in step when the person overrides the phone; `unspecified` hands it back to the phone.
  useEffect(() => {
    SystemAppearance.setColorScheme(modePreference === 'system' ? 'unspecified' : modePreference);
  }, [modePreference]);

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
      budgetTints: BUDGET_TINTS[mode],
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
