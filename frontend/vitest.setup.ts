// The /vitest entry point, not the bare package: from Vitest 5 the bare import
// registers the matchers at runtime but no longer augments Vitest's Assertion
// type, so tsc stops recognising toBeInTheDocument and friends.
import '@testing-library/jest-dom/vitest';

// lib/supabase.ts refuses to load without these, which is deliberate — a
// misconfigured build should fail loudly. Tests never reach Supabase, so
// throwaway values are enough to let the module import.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
