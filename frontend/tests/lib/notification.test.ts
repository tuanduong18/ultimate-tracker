import { describe, expect, it } from 'vitest';

import {
  archiveLabel,
  isReminder,
  linkFor,
  type AppNotification,
  type NotificationKind,
} from '@/lib/types/notification';

function of(kind: NotificationKind): AppNotification {
  return {
    id: 'n1',
    kind,
    title: 'Streaming renews in 2 days',
    body: 'USD 12.99 will be charged on 24 Oct 2026.',
    due_on: '2026-10-24',
    read_at: null,
    snoozed_at: null,
    archived_at: null,
    alerted_at: '2026-10-22T01:00:00Z',
    created_at: '2026-10-21T01:00:00Z',
  };
}

describe('isReminder', () => {
  it('is true for the countdowns and false for the notices', () => {
    expect(isReminder(of('subscription_renewal'))).toBe(true);
    expect(isReminder(of('trial_ending'))).toBe(true);
    expect(isReminder(of('subscription_renewed'))).toBe(false);
    expect(isReminder(of('currency_delisted'))).toBe(false);
  });
});

describe('linkFor', () => {
  it('sends each kind to where it can be acted on', () => {
    expect(linkFor('trial_ending')).toEqual({ href: '/finance', label: 'Manage subscription' });
    expect(linkFor('subscription_renewed').href).toBe('/finance/expenses');
    expect(linkFor('currency_delisted').href).toBe('/profile');
    expect(linkFor('budget_warning')).toEqual({ href: '/finance/budgets', label: 'View budgets' });
    expect(linkFor('budget_exceeded').href).toBe('/finance/budgets');
  });
});

describe('archiveLabel', () => {
  it('acknowledges news and files a renewal', () => {
    expect(archiveLabel('currency_delisted')).toBe('Got it');
    expect(archiveLabel('budget_warning')).toBe('Got it');
    expect(archiveLabel('budget_exceeded')).toBe('Got it');
    expect(archiveLabel('subscription_renewed')).toBe('Move to history');
  });
});
