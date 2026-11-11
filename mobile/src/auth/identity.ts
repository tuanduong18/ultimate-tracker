import type { User } from '@supabase/supabase-js';

import type { Profile } from '@/lib/types/profile';

/**
 * Who the signed-in person is, pieced together from two places — the phone's copy of
 * frontend/lib/identity.ts, so both clients call a person the same thing.
 *
 * The email and the sign-in methods belong to Supabase Auth and are read from the session — the
 * backend deliberately does not copy them. The name is the profile's own `display_name` when
 * set, and otherwise whatever the sign-in provider supplied (Google sends a full name; email
 * sign-up sends none).
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

/** "Tuan Nguyen" → "Tuan": a greeting uses the name people are called by, not the full one. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
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
