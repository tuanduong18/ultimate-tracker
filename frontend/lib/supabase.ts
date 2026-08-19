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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
