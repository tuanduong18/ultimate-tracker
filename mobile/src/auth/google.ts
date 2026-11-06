import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { describeAuthError } from '@/auth/errors';
import { supabase } from '@/lib/supabase';

/**
 * Signing in through a browser — Google, and the confirmation link in a sign-up email — and
 * coming back to the app.
 *
 * The browser returns to `auth/callback` on the app's link scheme. `Linking.createURL` gives
 * the right address for wherever the app is running: `ultimatetracker://auth/callback` in a
 * build, `exp://<computer>:8081/--/auth/callback` in Expo Go. Both must be on Supabase's list
 * of allowed redirect URLs.
 */
export const AUTH_CALLBACK_PATH = 'auth/callback';

export function authRedirectUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** What a sign-in redirect carries: a one-time code to exchange, or why it failed. */
export type AuthRedirect =
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string; cancelled: boolean }
  | null;

/**
 * Read a redirect URL. The failure reason is checked in the query and in the fragment — PKCE
 * reports in the query, but an error raised before the flow starts can come back in the hash.
 */
export function authRedirectFrom(url: string): AuthRedirect {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt === -1 ? '' : beforeHash.slice(queryAt + 1);
  const hash = hashAt === -1 ? '' : url.slice(hashAt + 1);

  for (const part of [query, hash]) {
    const params = new URLSearchParams(part);
    const reason = params.get('error');
    const message = params.get('error_description') ?? reason;
    // Google's "access_denied" is the person pressing Cancel: not an error to report.
    if (message) return { kind: 'error', message, cancelled: reason === 'access_denied' };
  }
  const code = new URLSearchParams(query).get('code');
  return code ? { kind: 'code', code } : null;
}

/** The outcome shown to the person: nothing (signed in, or they cancelled), or a message. */
export interface SignInOutcome {
  error?: string;
}

export const SIGN_IN_INCOMPLETE = 'The sign-in didn’t finish. Try again.';

// A code is exchanged once. The same redirect can arrive twice — the browser session hands it
// back, and Expo Router also opens auth/callback for it — and a second exchange of a spent code
// fails, which would show an error over a sign-in that worked.
const exchanges = new Map<string, Promise<SignInOutcome>>();

export function completeSignIn(redirect: AuthRedirect): Promise<SignInOutcome> {
  if (!redirect) return Promise.resolve({ error: SIGN_IN_INCOMPLETE });
  if (redirect.kind === 'error') {
    return Promise.resolve(redirect.cancelled ? {} : { error: redirect.message });
  }
  let pending = exchanges.get(redirect.code);
  if (!pending) {
    pending = supabase.auth
      .exchangeCodeForSession(redirect.code)
      .then(({ error }) => (error ? { error: describeAuthError(error) } : {}));
    exchanges.set(redirect.code, pending);
  }
  return pending;
}

/**
 * "Continue with Google": Supabase builds the Google URL, the system browser opens it in a
 * sheet over the app (Custom Tabs — the user's own Google session, password manager and
 * passkeys, which an in-app web view would not have), and the code comes back on the redirect.
 *
 * Closing the sheet is not an error: it resolves with nothing to say.
 */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error: describeAuthError(error) };
  if (!data.url) return { error: SIGN_IN_INCOMPLETE };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return {};
  return completeSignIn(authRedirectFrom(result.url));
}
