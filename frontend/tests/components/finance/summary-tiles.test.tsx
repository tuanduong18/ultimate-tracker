import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SummaryTiles } from '@/components/finance/summary-tiles';
import type { Resource } from '@/lib/hooks/use-collection';
import type { Subscription, Summary } from '@/lib/types/finance';
import { resource } from '@/tests/support/finance';

const TODAY = '2026-10-18';
const PREVIOUS_RANGE = { start: '2026-09-01', end: '2026-09-18' };

function summary(spent: string, budgeted = '0', remaining = '0'): Summary {
  return {
    currency: 'USD',
    starts_on: '2026-10-01',
    ends_on: '2026-10-31',
    spent,
    budgeted,
    remaining,
  };
}

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's',
    name: 'Netflix',
    amount: '19.990',
    currency: 'USD',
    interval_unit: 'month',
    interval_count: 1,
    category_id: null,
    started_on: '2026-01-20',
    trial_ends_on: null,
    next_billing_on: '2026-10-20',
    cancelled_on: null,
    note: null,
    created_at: '2026-01-20T00:00:00Z',
    ...overrides,
  };
}

function renderTiles({
  current = resource(summary('100.00')),
  previous = resource(summary('100.00')),
  subscriptions = [] as Subscription[],
}: {
  current?: Resource<Summary>;
  previous?: Resource<Summary>;
  subscriptions?: Subscription[];
} = {}) {
  return render(
    <SummaryTiles
      current={current}
      previous={previous}
      previousRange={PREVIOUS_RANGE}
      subscriptions={subscriptions}
      subscriptionsLoading={false}
      today={TODAY}
    />
  );
}

describe('SummaryTiles', () => {
  it('reports spending down on the same days last month as less, in words', () => {
    renderTiles({ current: resource(summary('80.00')), previous: resource(summary('100.00')) });

    expect(screen.getByText('$80.00')).toBeInTheDocument();
    // Direction is in the words, not only the colour.
    expect(screen.getByText(/20% less than/)).toBeInTheDocument();
  });

  it('reports spending up as more', () => {
    renderTiles({ current: resource(summary('150.00')), previous: resource(summary('100.00')) });

    expect(screen.getByText(/50% more than/)).toBeInTheDocument();
  });

  it('calls an empty month early rather than a 100% saving', () => {
    renderTiles({ current: resource(summary('0')), previous: resource(summary('120.00')) });

    expect(screen.getByText('Nothing spent yet this month')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('does not invent a percentage when nothing was spent last time', () => {
    renderTiles({ current: resource(summary('40.00')), previous: resource(summary('0')) });

    expect(screen.getByText(/nothing spent/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('names the soonest live subscription charge, skipping cancelled ones', () => {
    renderTiles({
      subscriptions: [
        subscription({
          id: 'a',
          name: 'Gym',
          next_billing_on: '2026-10-19',
          cancelled_on: '2026-10-01',
        }),
        subscription({ id: 'b', name: 'iCloud', next_billing_on: '2026-10-28', amount: '3.990' }),
        subscription({ id: 'c', name: 'Netflix', next_billing_on: '2026-10-20' }),
      ],
    });

    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText(/in 2 days/)).toBeInTheDocument();
    expect(screen.getByText('2 renewals in the next 30 days')).toBeInTheDocument();
    expect(screen.queryByText('Gym')).toBeNull();
  });

  it('has no budget tile — budgets are measured one by one in their panel', () => {
    renderTiles();

    expect(screen.queryByText(/budget/i)).toBeNull();
  });

  it('shows placeholders, not zeros, while the summary loads', () => {
    renderTiles({ current: resource<Summary>(null, { loading: true }) });

    expect(screen.queryByText('$0.00')).toBeNull();
  });
});
