import type { User } from '@supabase/supabase-js';

import type { Profile } from '@/lib/types/profile';

/**
 * Who the signed-in person is, pieced together from two places.
 *
 * The email and the sign-in method belong to Supabase Auth and are read from
 * the session — the backend deliberately does not copy them. The name is the
 * profile's own `display_name` when set, and otherwise whatever the sign-in
 * provider supplied (Google sends a full name; email sign-up sends none).
 */

/** The name a provider such as Google put on the account, if any. */
export function providerNameOf(user: User | null | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  const name: unknown = meta.full_name ?? meta.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function displayNameOf(
  profile: Pick<Profile, 'display_name'> | null | undefined,
  user: User | null | undefined
): string | null {
  return profile?.display_name ?? providerNameOf(user);
}

/** "Tuan Nguyen" → "T", falling back to the email's first letter, then "?". */
export function initialOf(name: string | null, email: string | null | undefined): string {
  const first = (name ?? email ?? '').trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email and password',
  google: 'Google',
};

/** Every way this account can sign in, in a human form: ["Google", "Email and password"]. */
export function signInMethodsOf(user: User | null | undefined): string[] {
  const providers: unknown = user?.app_metadata?.providers ?? user?.app_metadata?.provider;
  const list = Array.isArray(providers) ? providers : providers ? [providers] : [];
  return list
    .filter((p): p is string => typeof p === 'string')
    .map((p) => PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1));
}

/**
 * Fired after the profile is saved, so components that read it once on mount
 * (the account menu lives in the layout and never remounts) can refresh.
 */
export const PROFILE_CHANGED = 'profile:changed';

export function announceProfileChange(): void {
  window.dispatchEvent(new Event(PROFILE_CHANGED));
}
