import type { Metadata } from 'next';
import { ArrowRight, CircleDashed } from 'lucide-react';
import Link from 'next/link';

import { FinanceSnapshot } from '@/components/finance/finance-snapshot';
import { TrackerIllustration } from '@/components/shared/illustrations';
import { MODULES } from '@/components/shared/nav-items';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The landing page after sign-in: a greeting, this month's money at a glance,
 * and every module with an honest label on what is ready.
 *
 * Unbuilt modules stay clickable — their pages say what is coming — but wear a
 * "Coming in …" badge and a quieter card, so nobody clicks expecting a tracker
 * and finds a promise.
 */
export default function DashboardPage() {
  const modules = MODULES.filter((entry) => entry.href !== '/dashboard');

  return (
    <main className="space-y-10 p-4 sm:p-8">
      <section className="relative flex items-center gap-6 overflow-hidden rounded-3xl border border-border bg-surface-muted px-6 py-8 sm:px-10">
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-medium text-primary">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Your life, at a glance
          </h1>
          <p className="mt-2 text-sm text-fg-muted sm:text-base">
            Money is tracked today. Fitness, time and insights are on their way — each will show up
            here as it lands.
          </p>
          <Link
            href="/finance"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-xs hover:opacity-90"
          >
            Open Finance
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <TrackerIllustration className="ml-auto hidden max-w-72 md:block" />
      </section>

      <section aria-labelledby="money-this-month">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="money-this-month" className="text-lg font-semibold">
            Money this month
          </h2>
          <Link href="/finance" className="text-sm font-medium text-primary hover:underline">
            See all finance
          </Link>
        </div>
        <FinanceSnapshot />
      </section>

      <section aria-labelledby="modules">
        <h2 id="modules" className="mb-4 text-lg font-semibold">
          Modules
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((entry) => {
            const live = entry.status === 'live';
            const Icon = entry.icon;
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className={`group flex h-full items-start gap-4 rounded-2xl border border-border p-5 transition-colors hover:border-primary ${
                    live ? 'bg-surface shadow-xs' : 'bg-surface/60'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                      live ? 'bg-primary text-primary-fg' : 'bg-primary-soft text-primary'
                    }`}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{entry.label}</span>
                      {live ? (
                        <ArrowRight
                          aria-hidden
                          className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                        />
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                          <CircleDashed aria-hidden className="size-3" />
                          Coming in {entry.release}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-fg-muted">{entry.blurb}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
