'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Google's four-colour "G", as its sign-in branding guidelines ask for. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/**
 * "Continue with Google", for both sign-in and sign-up — with a provider there
 * is no difference: the first sign-in creates the account. A Google account
 * whose email matches an existing email-and-password account is linked to it
 * by Supabase, so it lands on the same profile rather than a second one.
 *
 * Supabase sends the browser back to /login carrying the session in the URL.
 * The client picks it up on load, and the login page's "already signed in"
 * redirect then forwards to `next`. That is why /login, not some callback
 * route, is the redirect target — and why it must be on the project's list of
 * allowed redirect URLs.
 */
export function OAuthButtons({ next, onError }: { next: string; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function continueWithGoogle() {
    setBusy(true);
    const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    // On success the browser is already navigating away; only a failure to
    // even start the redirect comes back here.
    if (error) {
      setBusy(false);
      onError(error.message);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void continueWithGoogle()}
      disabled={busy}
      className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 text-sm font-medium shadow-xs transition-colors hover:bg-surface-muted disabled:opacity-50"
    >
      <GoogleMark />
      {busy ? 'Redirecting to Google…' : 'Continue with Google'}
    </button>
  );
}

/** The "or" rule between the provider buttons and the email form. */
export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-fg-muted" role="separator">
      <span className="h-px flex-1 bg-border" />
      or with email
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * The reason a provider sign-in failed, as Supabase reports it on the way back
 * — `error_description` in the query string or, for the implicit flow, in the
 * hash. Null when the URL carries no error.
 */
export function oauthErrorFrom(search: string, hash: string): string | null {
  for (const part of [search, hash.replace(/^#/, '?')]) {
    const params = new URLSearchParams(part);
    const message = params.get('error_description') ?? params.get('error');
    if (message) return message;
  }
  return null;
}
