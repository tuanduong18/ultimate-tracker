'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // With email confirmation switched off Supabase returns a session straight
    // away; with it on there is no session until the link is clicked.
    if (data.session) {
      router.replace('/dashboard');
      return;
    }
    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500">
          We sent a confirmation link to <span className="font-mono">{email}</span>. Open it, then
          log in.
        </p>
        <p className="mt-6 text-sm">
          <Link className="underline" href="/login">
            Back to log in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Sign up</h1>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-gray-500">
        Already have an account?{' '}
        <Link className="underline" href="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}
