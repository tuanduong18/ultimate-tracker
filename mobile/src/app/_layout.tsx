import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import regularSymbols from 'expo-symbols/androidWeights/regular';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';

// Held until the icon font is ready, so the first frame already has its icons.
SplashScreen.preventAutoHideAsync();

/**
 * The root: the app's theme, and the navigation theme derived from it.
 *
 * Material Symbols come from a font that SymbolView would otherwise load on first use, leaving
 * each icon blank for a beat; loading it here behind the splash screen means no icon ever
 * pops in. The window behind every screen and the status bar follow the theme too, so no
 * transition ever shows a white frame in dark mode.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ [regularSymbols.name]: regularSymbols.font });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppThemeProvider>
      <ThemedNavigation>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemedNavigation>
    </AppThemeProvider>
  );
}

function ThemedNavigation({ children }: { children: ReactNode }) {
  const { colors, mode } = useAppTheme();

  const navigationTheme = useMemo<Theme>(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.fg,
        border: colors.border,
        notification: colors.negative,
      },
    };
  }, [colors, mode]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <ThemeProvider value={navigationTheme}>
      {children}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
