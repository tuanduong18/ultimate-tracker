'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthShell, Field, SubmitButton } from '@/components/shared/auth-shell';
import { OAuthButtons, OrDivider, oauthErrorFrom } from '@/components/shared/oauth-buttons';
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
  // A Google sign-in that was cancelled or refused comes back with the reason
  // in the URL. Safe to read while rendering: useSearchParams opts this form
  // out of prerendering, so it only ever renders in the browser.
  const [error, setError] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (oauthErrorFrom(window.location.search, window.location.hash) ?? '')
  );
  const [submitting, setSubmitting] = useState(false);

  // Someone who is already signed in has no business on the login page. This
  // is also how a Google sign-in finishes: it returns here with the session in
  // the URL, and the redirect fires once the client has picked it up.
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
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          No account yet?{' '}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/signup"
          >
            Create one
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} onError={setError} />
      <OrDivider />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton busy={submitting}>{submitting ? 'Signing in…' : 'Log in'}</SubmitButton>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative"
        >
          {error}
        </p>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={<main className="p-8 text-sm text-fg-muted">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
