import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useSession } from '@/auth/session';
import { api } from '@/lib/api-client';
import type { AppNotification, NotificationChange } from '@/lib/notifications/notifications';
import { supabase } from '@/lib/supabase';

/**
 * The notifications, as hooks over the app's one cache — the phone's half of the web's bell,
 * /notifications page and useNotificationUpdates. Paths and parameters are the web's.
 *
 * Every key starts with 'notifications', so a change reloads the inbox and the history at once:
 * snoozing moves a reminder from one to the other.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: ['notifications', 'inbox'] as const,
  history: ['notifications', 'history'] as const,
};

/** The safety net under Realtime, as on the web: a dropped socket costs at most this long. */
export const POLL_MS = 5 * 60 * 1000;

/** As many as the web's page shows; one person's notifications never come near it. */
const LIMIT = 100;

/**
 * What needs the person now — neither snoozed nor archived, newest first. The bell counts its
 * unread rows and the Notifications screen lists it, from this one query however many bells are
 * mounted (one per tab's top bar).
 */
export function useInbox() {
  return useQuery({
    queryKey: notificationKeys.inbox,
    queryFn: () => api.get<AppNotification[]>(`/notifications?view=inbox&limit=${LIMIT}`),
    refetchInterval: POLL_MS,
  });
}

/** Snoozed reminders, which can be unsnoozed, and notices moved there, which can be deleted. */
export function useHistory() {
  return useQuery({
    queryKey: notificationKeys.history,
    queryFn: () => api.get<AppNotification[]>(`/notifications?view=history&limit=${LIMIT}`),
  });
}

/**
 * One change to one notification — read, snooze, archive or delete — then a reload of both lists,
 * waited for, so the row moves only once the server has moved it.
 */
export function useNotificationChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: { id: string; change: NotificationChange }) => {
      const path = `/notifications/${id}`;
      if (change === 'delete') await api.delete<void>(path);
      else await api.patch<AppNotification>(path, change);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/**
 * Mark these as read — what opening the inbox does, as opening the web's bell panel does. Each
 * one is sent on its own (the API takes one at a time), and the lists reload after all of them
 * have answered, failures included, so what shows is what the server now holds. A failure is
 * silent: the row stays unread and is counted again, which is the truth.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useCallback(
    async (ids: readonly string[]) => {
      if (ids.length === 0) return;
      await Promise.allSettled(
        ids.map((id) => api.patch<AppNotification>(`/notifications/${id}`, { read: true }))
      );
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    [queryClient]
  );
}

/**
 * Keep the notifications live while the app is open: Supabase Realtime pushes this person's
 * inserts and updates — a scheduled job's reminder, a snooze on the web — and the lists reload.
 * Mounted once, under the tabs, rather than in each bell: five bells would open five sockets for
 * one stream of changes.
 *
 * - Row-level security on the table makes sure only the person's own rows arrive.
 * - Deletes are listened to without a filter: Postgres cannot check a deleted row against a
 *   policy, so Supabase cannot filter them, and the event carries only an id. It costs one extra
 *   reload.
 * - Coming back to the app refetches (lib/query.tsx's focus manager) and the inbox polls every
 *   five minutes, so a socket that dropped while the phone slept costs nothing lasting.
 */
export function useNotificationUpdates(): void {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    const reload = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        reload
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, reload)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
