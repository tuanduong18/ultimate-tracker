/**
 * The app's public configuration, compiled in from mobile/.env at bundle time.
 *
 * Each name is written out in full on purpose: Expo inlines `process.env.EXPO_PUBLIC_…` only
 * when the whole name appears in the source, so a lookup by a computed key is always
 * undefined. Every value here is public — anyone holding the APK can read it — so nothing
 * secret may ever be added.
 *
 * A missing value fails loudly where the mistake is, as on the web: a placeholder would boot
 * the app and then fail every sign-in with an opaque error.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy mobile/.env.example to mobile/.env, fill it in, then restart ` +
        'Expo with `npx expo start --go --clear`.'
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = required(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

/** The FastAPI backend, without `/api/v1` — the API client adds it, as the web's does. */
export const API_BASE_URL = required(
  'EXPO_PUBLIC_API_BASE_URL',
  process.env.EXPO_PUBLIC_API_BASE_URL
);
