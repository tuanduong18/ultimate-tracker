import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODES,
  THEMES,
  type ModePreference,
  type ThemeId,
} from '@/theme/themes';

/**
 * Remembering the look on this phone — per device, as on the web: a dark room at night and a
 * bright desk by day are different devices' business, while things that travel with the account
 * (the display currency) live on the profile.
 *
 * Kept in SecureStore although nothing here is secret: it is the one persistent store already in
 * the development build, and AsyncStorage would cost a new build to hold two short strings. The
 * web's keys use a colon, which SecureStore refuses, so these use a dot.
 */
export const THEME_KEY = 'ultimate-tracker.theme';
export const MODE_KEY = 'ultimate-tracker.mode';

export interface Appearance {
  theme: ThemeId;
  mode: ModePreference;
}

const isThemeId = (value: string | null): value is ThemeId =>
  THEMES.some((theme) => theme.id === value);

const isMode = (value: string | null): value is ModePreference =>
  MODES.some((mode) => mode.id === value);

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/**
 * The stored choice, or the defaults for anything missing or unrecognised — a scheme renamed in a
 * later version must not leave the app without colours.
 */
export async function loadAppearance(): Promise<Appearance> {
  const [theme, mode] = await Promise.all([read(THEME_KEY), read(MODE_KEY)]);
  return {
    theme: isThemeId(theme) ? theme : DEFAULT_THEME,
    mode: isMode(mode) ? mode : DEFAULT_MODE,
  };
}

/**
 * Store a choice. Failing to remember is never worth an error on screen: the change has already
 * applied, and the worst outcome is the default look at the next launch.
 */
export async function saveAppearance({ theme, mode }: Appearance): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(THEME_KEY, theme),
      SecureStore.setItemAsync(MODE_KEY, mode),
    ]);
  } catch {
    // Silent on purpose — see above.
  }
}

/** The stored appearance, or null until it has been read (the splash screen waits for it). */
export function useStoredAppearance(): Appearance | null {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  useEffect(() => {
    let active = true;
    void loadAppearance().then((loaded) => {
      if (active) setAppearance(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return appearance;
}
