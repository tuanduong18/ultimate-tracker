import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  notificationKeys,
  useMarkRead,
  useNotificationChange,
  useNotificationUpdates,
} from '@/lib/notifications/queries';

const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: {
    get: jest.fn(),
    patch: (path: string, body: unknown) => mockPatch(path, body),
    delete: (path: string) => mockDelete(path),
  },
}));

let mockUserId: string | undefined = 'u1';
jest.mock('@/auth/session', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

// A stand-in for Supabase Realtime: records each listener, so a test can fire a change.
const mockListeners: { filter: object; fire: () => void }[] = [];
const mockRemoveChannel = jest.fn();
const mockChannelName = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      mockChannelName(name);
      const channel = {
        on: (_type: string, filter: object, fire: () => void) => {
          mockListeners.push({ filter, fire });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: (channel: unknown) => mockRemoveChannel(channel),
  },
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, invalidate };
}

beforeEach(() => {
  mockPatch.mockReset().mockResolvedValue({});
  mockDelete.mockReset().mockResolvedValue(undefined);
  mockListeners.length = 0;
  mockRemoveChannel.mockClear();
  mockChannelName.mockClear();
  mockUserId = 'u1';
});

describe('useMarkRead', () => {
  it('marks each one read, then reloads the lists even when one failed', async () => {
    const { Wrapper, invalidate } = setup();
    mockPatch.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useMarkRead(), { wrapper: Wrapper });

    await act(() => result.current(['n1', 'n2']));

    expect(mockPatch).toHaveBeenCalledWith('/notifications/n1', { read: true });
    expect(mockPatch).toHaveBeenCalledWith('/notifications/n2', { read: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
  });

  it('asks nothing when there is nothing unread', async () => {
    const { Wrapper, invalidate } = setup();
    const { result } = await renderHook(() => useMarkRead(), { wrapper: Wrapper });

    await act(() => result.current([]));

    expect(mockPatch).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useNotificationChange', () => {
  it('patches a change and deletes on delete, reloading both lists after', async () => {
    const { Wrapper, invalidate } = setup();
    const { result } = await renderHook(() => useNotificationChange(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ id: 'n1', change: { snoozed: true } }));
    expect(mockPatch).toHaveBeenCalledWith('/notifications/n1', { snoozed: true });

    await act(() => result.current.mutateAsync({ id: 'n2', change: 'delete' }));
    expect(mockDelete).toHaveBeenCalledWith('/notifications/n2');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
  });
});

describe('useNotificationUpdates', () => {
  it('listens to the person’s own rows, and to deletes unfiltered, and reloads on either', async () => {
    const { Wrapper, invalidate } = setup();
    const { unmount } = await renderHook(() => useNotificationUpdates(), { wrapper: Wrapper });

    expect(mockChannelName).toHaveBeenCalledWith('notifications:u1');
    expect(mockListeners.map((l) => l.filter)).toEqual([
      { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.u1' },
      { event: 'DELETE', schema: 'public', table: 'notifications' },
    ]);

    await act(async () => mockListeners[0].fire());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all });

    await unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('opens no channel while nobody is signed in', async () => {
    mockUserId = undefined;
    const { Wrapper } = setup();
    await renderHook(() => useNotificationUpdates(), { wrapper: Wrapper });
    expect(mockChannelName).not.toHaveBeenCalled();
  });
});
