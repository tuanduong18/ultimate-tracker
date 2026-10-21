import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppNotification } from '@/lib/types/notification';

const { get, patch, del, channel } = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return { get: vi.fn(), patch: vi.fn(), del: vi.fn(), channel };
});

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, patch, delete: del } };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => channel,
    removeChannel: vi.fn(),
  },
}));

import { NotificationBell } from '@/components/notifications/notification-bell';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'subscription_renewal',
    title: 'Streaming renews in 2 days',
    body: 'USD 12.99 will be charged on 24 Oct 2026.',
    due_on: '2026-10-24',
    read_at: null,
    snoozed_at: null,
    archived_at: null,
    alerted_at: '2026-10-22T01:00:00Z',
    created_at: '2026-10-21T01:00:00Z',
    ...overrides,
  };
}

const READ = { read_at: '2026-10-22T02:00:00Z' };

afterEach(() => {
  vi.clearAllMocks();
});

async function openBell(name = 'Notifications') {
  render(<NotificationBell />);
  fireEvent.click(await screen.findByRole('button', { name }));
}

describe('NotificationBell', () => {
  it('counts unread notifications in the inbox', async () => {
    get.mockResolvedValue([notification(), notification({ id: 'n2', title: 'Seen', ...READ })]);

    render(<NotificationBell />);

    expect(await screen.findByRole('button', { name: 'Notifications, 1 new' })).toBeInTheDocument();
  });

  it('marks what it shows as read when opened, but keeps showing it', async () => {
    get.mockResolvedValue([notification()]);
    patch.mockResolvedValue({});

    await openBell('Notifications, 1 new');

    expect(screen.getByText('Streaming renews in 2 days')).toBeInTheDocument();
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/notifications/n1', { read: true }));
  });

  it('snoozes a reminder and links to the subscription', async () => {
    get.mockResolvedValue([notification(READ)]);
    patch.mockResolvedValue({});
    await openBell();

    expect(screen.getByRole('link', { name: 'Manage subscription' })).toHaveAttribute(
      'href',
      '/finance'
    );
    expect(screen.queryByRole('button', { name: 'Move to history' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/notifications/n1', { snoozed: true }));
  });

  it('moves a renewal notice to the history', async () => {
    get.mockResolvedValue([
      notification({ kind: 'subscription_renewed', title: 'Streaming auto-renewed', ...READ }),
    ]);
    patch.mockResolvedValue({});
    await openBell();

    expect(screen.queryByRole('button', { name: 'Snooze' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move to history' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/notifications/n1', { archived: true })
    );
  });

  it('listens for live changes to the signed-in user’s notifications', async () => {
    get.mockResolvedValue([]);

    render(<NotificationBell />);

    await waitFor(() =>
      expect(channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'notifications', filter: 'user_id=eq.u1' }),
        expect.any(Function)
      )
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('says so when there is nothing in the inbox', async () => {
    get.mockResolvedValue([]);

    await openBell();

    expect(await screen.findByText('You’re all caught up.')).toBeInTheDocument();
  });
});
