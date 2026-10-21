import { ArrowRight, CircleCheck, Globe2, LineChart, PiggyBank, Repeat } from 'lucide-react';
import Link from 'next/link';

import { HomeActions } from '@/components/home/home-actions';
import { Wordmark } from '@/components/shared/brand';
import { TrackerIllustration } from '@/components/shared/illustrations';
import { MODULES } from '@/components/shared/nav-items';

/**
 * What finance — the module that is live — actually does today. Nothing here
 * may promise more than the specs in docs/features say is built.
 */
const FINANCE_FEATURES = [
  {
    icon: Globe2,
    title: 'Any currency, one total',
    text: 'Log each expense in the currency you paid in. Totals convert into the one you think in.',
  },
  {
    icon: PiggyBank,
    title: 'Budgets that fit your life',
    text: 'A monthly cap that resets itself, or a fixed one for a trip — across as many categories as you like.',
  },
  {
    icon: Repeat,
    title: 'Subscriptions in plain sight',
    text: 'Every recurring charge and free trial in one list, with the next billing date worked out for you.',
  },
  {
    icon: LineChart,
    title: 'See where it goes',
    text: 'Spending by category and by week, side by side with the period before.',
  },
] as const;

const STEPS = [
  { title: 'Sign up in seconds', text: 'With Google, or an email and password.' },
  { title: 'Log as you go', text: 'An expense takes a few taps; subscriptions log themselves.' },
  { title: 'Read the patterns', text: 'Charts and budgets turn the entries into answers.' },
] as const;

const CLOSING_POINTS = [
  'Sign in with Google or email',
  'Works on your phone',
  'Five colour themes, dark mode included',
] as const;

/**
 * The public front door. Says what the app is for, shows honestly which parts
 * exist — finance today, the rest labelled with the release they are planned
 * for — and gets a visitor to sign-up in one click.
 *
 * A server component apart from HomeActions, which needs the session to tell
 * a returning user from a new one.
 */
export default function HomePage() {
  const modules = MODULES.filter((entry) => entry.href !== '/dashboard');

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg">
          <Wordmark nameClassName="text-lg" />
        </Link>
        <HomeActions compact />
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-2 lg:pt-16 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Finance is live — more modules on the way
            </p>
            <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Track every part of your life — and see how they{' '}
              <span className="text-primary">connect</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-fg-muted sm:text-lg">
              Money, training, time and habits usually live in five different apps that never talk
              to each other. Ultimate Tracker keeps them in one place, starting with where your
              money goes.
            </p>
            <div className="mt-8">
              <HomeActions />
            </div>
          </div>
          <div className="relative rounded-3xl bg-primary-soft p-6 sm:p-10">
            <TrackerIllustration className="mx-auto max-w-md" />
          </div>
        </section>

        {/* Finance, today */}
        <section aria-labelledby="finance" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-medium text-primary">Available now</p>
            <h2 id="finance" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Your money, without the spreadsheet
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FINANCE_FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-border bg-bg p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Every module, with an honest status */}
        <section aria-labelledby="modules" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="modules" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            One app, growing module by module
          </h2>
          <p className="mt-2 max-w-2xl text-fg-muted">
            Each module ships when it is ready, and the insights get sharper with every one that
            joins.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {modules.map((entry) => {
              const live = entry.status === 'live';
              const Icon = entry.icon;
              return (
                <li
                  key={entry.href}
                  className={`rounded-2xl border p-5 ${live ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon
                      aria-hidden
                      className={`size-6 ${live ? 'text-primary' : 'text-fg-subtle'}`}
                    />
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${live ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-fg-muted'}`}
                    >
                      {live
                        ? 'Live'
                        : entry.release.startsWith('v')
                          ? `Coming in ${entry.release}`
                          : 'Coming later'}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{entry.label}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{entry.blurb}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ title, text }, index) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex flex-col items-start gap-6 rounded-3xl bg-primary px-6 py-10 text-primary-fg sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Start with this month.</h2>
              <ul className="mt-3 space-y-1.5 text-sm opacity-90">
                {CLOSING_POINTS.map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <CircleCheck aria-hidden className="size-4" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-5 text-sm font-medium text-fg shadow-xs transition-opacity hover:opacity-90"
            >
              Create your account
              <ArrowRight aria-hidden className="size-4 text-primary" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark nameClassName="text-sm" />
          <p>Money, body and time, in one place.</p>
        </div>
      </footer>
    </div>
  );
}
