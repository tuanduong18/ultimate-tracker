import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppNotification } from '@/lib/types/notification';

const { patch, del } = vi.hoisted(() => ({ patch: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { patch, delete: del } };
});

import { NotificationItem } from '@/components/notifications/notification-item';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'subscription_renewal',
    title: 'Streaming renews tomorrow',
    body: 'USD 12.99 will be charged on 24 Oct 2026.',
    due_on: '2026-10-24',
    read_at: '2026-10-23T01:00:00Z',
    snoozed_at: null,
    archived_at: null,
    alerted_at: '2026-10-23T01:00:00Z',
    created_at: '2026-10-21T01:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('NotificationItem in the history', () => {
  it('lets a snoozed reminder be unsnoozed, in case it was a mistake', async () => {
    patch.mockResolvedValue({});
    const onChanged = vi.fn();
    render(
      <NotificationItem
        notification={notification({ snoozed_at: '2026-10-22T01:00:00Z' })}
        onChanged={onChanged}
      />
    );

    expect(screen.queryByRole('button', { name: 'Snooze' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unsnooze' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/notifications/n1', { snoozed: false })
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('deletes an archived notice', async () => {
    del.mockResolvedValue(undefined);
    render(
      <NotificationItem
        notification={notification({
          kind: 'subscription_renewed',
          title: 'Streaming auto-renewed on 24 Oct',
          archived_at: '2026-10-24T02:00:00Z',
        })}
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/notifications/n1'));
  });

  it('shows an error the server gave rather than failing silently', async () => {
    patch.mockRejectedValue(new Error('offline'));
    render(<NotificationItem notification={notification()} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update this notification.'
    );
  });
});
