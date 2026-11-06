import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import regularSymbols from 'expo-symbols/androidWeights/regular';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { SessionProvider, useSession } from '@/auth/session';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';

// Held until the icon font and the stored session are ready, so the first frame is the right
// screen with its icons already drawn.
SplashScreen.preventAutoHideAsync();

/**
 * The root: who is signed in, the app's theme, and the navigation theme derived from it.
 *
 * Material Symbols come from a font that SymbolView would otherwise load on first use, leaving
 * each icon blank for a beat; loading it here behind the splash screen means no icon ever
 * pops in. The window behind every screen and the status bar follow the theme too, so no
 * transition ever shows a white frame in dark mode.
 */
export default function RootLayout() {
  return (
    <SessionProvider>
      <AppThemeProvider>
        <Root />
      </AppThemeProvider>
    </SessionProvider>
  );
}

/**
 * Two guarded groups: the tabs for someone signed in, Log in and Sign up for everyone else.
 * When the session changes — signing in, logging out, a 401 from the API — the guard moves
 * the person to the other group by itself, so no screen navigates after an auth call.
 * The start (`index`) and the sign-in callback sit outside both: the callback must open
 * whichever side the person is on when the browser hands them back.
 */
function Root() {
  const [fontsLoaded, fontError] = useFonts({ [regularSymbols.name]: regularSymbols.font });
  const { session, loading } = useSession();
  const ready = (fontsLoaded || fontError !== null) && !loading;
  const signedIn = session !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemedNavigation>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/dashboard">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
    </ThemedNavigation>
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
