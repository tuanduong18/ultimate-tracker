import '@testing-library/jest-dom';

// lib/supabase.ts refuses to load without these, which is deliberate — a
// misconfigured build should fail loudly. Tests never reach Supabase, so
// throwaway values are enough to let the module import.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
