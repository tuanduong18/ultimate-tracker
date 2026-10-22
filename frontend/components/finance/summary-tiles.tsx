'use client';

import clsx from 'clsx';
import { CalendarClock, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { daysUntil, formatDate, formatSpan, type DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type Subscription, type Summary } from '@/lib/types/finance';

/** Live: not cancelled, or cancelled for a date still ahead. */
function isLive(subscription: Subscription, today: string): boolean {
  return subscription.cancelled_on === null || subscription.cancelled_on > today;
}

function Tile({
  label,
  icon: Icon,
  loading,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5">
      <header className="flex items-center gap-2 text-sm text-fg-muted">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon aria-hidden className="size-4" />
        </span>
        <h2>{label}</h2>
      </header>
      {loading ? (
        // Shapes rather than a spinner, so the row does not jump when it lands.
        // The shapes mean nothing to a screen reader, so it gets the word.
        <div className="mt-4 space-y-2">
          <span className="sr-only">Loading…</span>
          <div
            aria-hidden
            className="h-7 w-32 animate-pulse rounded-md bg-fg/10 motion-reduce:animate-none"
          />
          <div
            aria-hidden
            className="h-4 w-44 animate-pulse rounded-md bg-fg/10 motion-reduce:animate-none"
          />
        </div>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );
}

/** The big figure in a tile: proportional digits, as a standalone number should be. */
function Figure({ children, tone }: { children: ReactNode; tone?: 'negative' }) {
  return (
    <p
      className={clsx(
        'text-2xl font-semibold tracking-tight sm:text-[1.75rem]',
        tone === 'negative' && 'text-negative'
      )}
    >
      {children}
    </p>
  );
}

/**
 * Month-to-date spend against the same days of last month.
 *
 * Down is good here, so a fall is drawn in `positive` and a rise in `negative`
 * — and each carries an arrow and words, never colour alone.
 */
function SpentTile({
  current,
  previous,
  previousRange,
}: {
  current: Resource<Summary>;
  previous: Resource<Summary>;
  previousRange: DateRange;
}) {
  const now = current.data;
  const before = previous.data;
  const versus = formatSpan(previousRange.start, previousRange.end);

  let delta: ReactNode = null;
  if (now && before) {
    const was = Number(before.spent);
    const is = Number(now.spent);
    if (is === 0) {
      // A month with nothing in it yet is not a 100% saving; it is just early.
      delta = <span className="text-fg-muted">Nothing spent yet this month</span>;
    } else if (was > 0 && Number.isFinite(is)) {
      const change = Math.round(((is - was) / was) * 100);
      const down = change < 0;
      const Arrow = down ? TrendingDown : TrendingUp;
      delta =
        change === 0 ? (
          <span className="text-fg-muted">Level with {versus}</span>
        ) : (
          <span
            className={clsx(
              'inline-flex items-center gap-1 font-medium',
              down ? 'text-positive' : 'text-negative'
            )}
          >
            <Arrow aria-hidden className="size-4" />
            {Math.abs(change)}% {down ? 'less' : 'more'} than {versus}
          </span>
        );
    } else {
      delta = <span className="text-fg-muted">Nothing spent {versus}</span>;
    }
  }

  return (
    <Tile label="Spent this month" icon={Wallet} loading={current.loading}>
      {now ? (
        <>
          <Figure>{formatMoney(now.spent, now.currency)}</Figure>
          <p className="mt-1 text-sm">{delta}</p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">{current.error ?? 'Not available.'}</p>
      )}
    </Tile>
  );
}

function inDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** The soonest live subscription charge, and how many more land this month. */
function RenewalTile({
  subscriptions,
  loading,
  today,
}: {
  subscriptions: Subscription[];
  loading: boolean;
  today: string;
}) {
  const upcoming = subscriptions
    .filter((s) => isLive(s, today) && s.next_billing_on >= today)
    .sort((a, b) => a.next_billing_on.localeCompare(b.next_billing_on));
  const next = upcoming[0];
  const withinMonth = upcoming.filter((s) => daysUntil(s.next_billing_on, today) <= 30).length;

  return (
    <Tile label="Next subscription" icon={CalendarClock} loading={loading}>
      {next ? (
        <>
          <Figure>{formatMoney(next.amount, next.currency)}</Figure>
          <p className="mt-1 truncate text-sm">
            <span className="font-medium">{next.name}</span>{' '}
            <span className="text-fg-muted">
              {inDays(daysUntil(next.next_billing_on, today))} · {formatDate(next.next_billing_on)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {withinMonth} renewal{withinMonth === 1 ? '' : 's'} in the next 30 days
          </p>
        </>
      ) : (
        <>
          <Figure>—</Figure>
          <p className="mt-1 text-sm text-fg-muted">No renewals coming up.</p>
        </>
      )}
    </Tile>
  );
}

/**
 * The headline numbers the finance page leads with: how much has gone out this
 * month, and which subscription charges next.
 *
 * No budget tile. Budgets each cover their own dates and categories, and may be
 * in different currencies, so there is no honest single "budget left" figure —
 * the Budgets panel shows each one against its own cap instead.
 *
 * Stat tiles rather than charts: each answers one question with one figure,
 * and a chart of a single value only makes it harder to read.
 */
export function SummaryTiles({
  current,
  previous,
  previousRange,
  subscriptions,
  subscriptionsLoading,
  today,
}: {
  /** This calendar month, in the display currency. Only `spent` is read. */
  current: Resource<Summary>;
  /** The same days of last month, for the comparison. */
  previous: Resource<Summary>;
  previousRange: DateRange;
  subscriptions: Subscription[];
  subscriptionsLoading: boolean;
  today: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SpentTile current={current} previous={previous} previousRange={previousRange} />
      <RenewalTile subscriptions={subscriptions} loading={subscriptionsLoading} today={today} />
    </div>
  );
}
