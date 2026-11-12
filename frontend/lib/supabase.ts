import { createClient } from '@supabase/supabase-js';

// Real values come from NEXT_PUBLIC_SUPABASE_* env vars. These are baked into
// the bundle at build time, so a missing one cannot be fixed by restarting —
// it needs a rebuild. Falling back to placeholders hid that: the app booted and
// then failed every sign-in with an opaque error. Fail where the mistake is,
// instead. CI and vitest supply throwaway values explicitly.
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy frontend/.env.example to frontend/.env.local for local ` +
        'development, or set it in the Vercel project and redeploy.'
    );
  }
  return value;
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * PKCE, as on the Android app (mobile/src/lib/supabase.ts). This version of
 * supabase-js defaults to the implicit flow, which puts the access and refresh
 * tokens themselves in the address the browser comes back to — where browser
 * history, extensions and anything that reads the page address can see them.
 * With PKCE that address carries only a one-time code, worthless without the
 * secret this browser kept when the sign-in started; the client exchanges it
 * on load (detectSessionInUrl, on by default) and removes it from the address.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
});
