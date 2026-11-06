// First, before supabase-js: React Native's URL has no `protocol` setter, which the client
// assigns while it builds its realtime address — without the polyfill it throws on creation.
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { secureSessionStorage } from '@/lib/secure-session-storage';

/**
 * The app's Supabase client: the same project and the same tokens as the web, so the backend
 * needs no change to accept the phone.
 *
 * - The session lives in Android's encrypted storage (see secure-session-storage.ts).
 * - **PKCE**, set explicitly: this version of supabase-js defaults to the implicit flow, which
 *   hands tokens back in the redirect itself. With PKCE the redirect carries only a one-time
 *   code, useless to any app but the one holding the matching secret — which matters because
 *   the redirect travels through the browser and a link scheme.
 * - `detectSessionInUrl` off: there is no page URL on a phone; redirects are handled in
 *   auth/google.ts.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Refresh the token only while the app is in front, as Supabase advises for React Native: a
 * timer running in the background is what Android's battery savers kill, and a refresh that
 * dies halfway can sign the user out. Coming back to the front refreshes straight away if due.
 */
if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
