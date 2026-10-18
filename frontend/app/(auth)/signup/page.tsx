'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { MailCheck } from 'lucide-react';

import { AuthShell, Field, SubmitButton } from '@/components/shared/auth-shell';
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
      <AuthShell
        title="Check your email"
        footer={
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/login"
          >
            Back to log in
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4 text-sm">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            We sent a confirmation link to <span className="font-medium">{email}</span>. Open it,
            then log in.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with your money — the rest of your life follows."
      footer={
        <>
          Already have an account?{' '}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/login"
          >
            Log in
          </Link>
        </>
      }
    >
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
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton busy={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </SubmitButton>
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
