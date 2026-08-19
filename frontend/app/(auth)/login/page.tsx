'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { useSession } from '@/lib/hooks/use-session';
import { supabase } from '@/lib/supabase';

/** Where to go after signing in — only ever a path inside this app. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { session, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Someone who is already signed in has no business on the login page.
  useEffect(() => {
    if (!loading && session) router.replace(next);
  }, [loading, session, next, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }
    router.replace(next);
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Log in</h1>

      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="mt-1 w-full rounded border px-3 py-2"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-gray-500">
        No account yet?{' '}
        <Link className="underline" href="/signup">
          Sign up
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={<main className="p-8 text-sm text-gray-500">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
