'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/lib/hooks/use-session';

const PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-fg shadow-xs transition-opacity hover:opacity-90';
const SECONDARY =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium shadow-xs transition-colors hover:bg-surface-muted';

/**
 * The calls to action on the welcome page: sign up and log in for a visitor,
 * one button back into the app for someone already signed in.
 *
 * Split out as the page's only client island, so the rest of the welcome page
 * stays a server component. Until the stored session is read it renders the
 * visitor version — the likelier case on a public page, and a link that is
 * still correct for everyone, since /login forwards a signed-in user on.
 */
export function HomeActions({ compact = false }: { compact?: boolean }) {
  const { session, loading } = useSession();

  if (!loading && session) {
    return (
      <Link href="/dashboard" className={PRIMARY}>
        Open dashboard
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-primary-soft"
        >
          Log in
        </Link>
        <Link href="/signup" className={PRIMARY}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/signup" className={PRIMARY}>
        Get started
        <ArrowRight aria-hidden className="size-4" />
      </Link>
      <Link href="/login" className={SECONDARY}>
        I already have an account
      </Link>
    </div>
  );
}
