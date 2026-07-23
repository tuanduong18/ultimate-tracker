import { createClient } from '@supabase/supabase-js';

// Real values come from NEXT_PUBLIC_SUPABASE_* env vars. The fallbacks keep
// imports (and CI builds/tests) from throwing when env is not configured — they
// are NOT valid for talking to a real Supabase project.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
