'use client';

import { Eye, EyeOff, LineChart, Repeat, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Wordmark } from '@/components/shared/brand';
import { TrackerIllustration } from '@/components/shared/illustrations';

const HIGHLIGHTS = [
  { icon: Wallet, text: 'Expenses and budgets in any currency' },
  { icon: Repeat, text: 'Subscriptions that log themselves' },
  { icon: LineChart, text: 'See where it all goes, at a glance' },
] as const;

/**
 * The sign-in and sign-up frame: a brand panel beside the form on wide
 * screens, the form alone under the wordmark on phones.
 *
 * The brand panel is decoration with a job — it says what the app is for to
 * someone who has not used it yet — so it gives way entirely on a phone, where
 * the form is the only thing worth the space.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-1/2 max-w-xl flex-col justify-between border-r border-border bg-surface-muted p-12 lg:flex">
        <Wordmark nameClassName="text-lg" />
        <div>
          <TrackerIllustration className="mx-auto max-w-sm" />
          <h2 className="mt-10 text-3xl leading-tight font-semibold tracking-tight">
            Track every part of your life — and see how they connect.
          </h2>
          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-fg-muted">
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface text-primary">
                  <Icon aria-hidden className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-fg-muted">Money, body and time, in one place.</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-10 lg:hidden" nameClassName="text-lg" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/**
 * A labelled input for the auth forms, with an optional hint under it.
 *
 * Passwords get a show/hide toggle: typing a long password blind on a phone
 * keyboard is the most common reason a first sign-in fails.
 */
export function Field({
  id,
  label,
  type = 'text',
  hint,
  ...input
}: {
  id: string;
  label: string;
  type?: 'email' | 'password' | 'text';
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>) {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          aria-describedby={hintId}
          className={`min-h-11 w-full rounded-lg border bg-surface px-3 text-sm ${isPassword ? 'pr-12' : ''}`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((current) => !current)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-fg-muted hover:text-fg"
          >
            {shown ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The full-width primary button that submits an auth form. */
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
