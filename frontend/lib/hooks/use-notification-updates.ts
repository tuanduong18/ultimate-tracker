'use client';

import { useEffect, useId, useRef } from 'react';

import { useSession } from '@/lib/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { NOTIFICATIONS_CHANGED } from '@/lib/types/notification';

/** The safety net under Realtime: a dropped socket costs at most this long. */
const POLL_MS = 5 * 60 * 1000;

/**
 * Call `onChange` whenever the signed-in user's notifications may have changed,
 * so a list can refetch.
 *
 * - **Supabase Realtime** pushes inserts and updates to this user's rows — from
 *   the scheduled job, an edit in another tab, another device. Row-level
 *   security on the table makes sure only their own rows arrive.
 * - Deletes are listened to without a filter: Postgres cannot check a deleted
 *   row against a policy, so Supabase cannot filter them, and the event
 *   carries only an id. It just means one extra refetch.
 * - A change made in this tab announces itself (NOTIFICATIONS_CHANGED), which
 *   is faster than waiting for the round trip through Realtime.
 * - Refocusing the tab, and a slow poll, cover a socket that dropped.
 */
export function useNotificationUpdates(onChange: () => void): void {
  const { session } = useSession();
  const userId = session?.user.id;
  // Two mounted lists (the bell and the page) need two channels; Supabase
  // refuses a second subscription to the same channel name.
  const channelId = useId();
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const fire = () => latest.current();
    window.addEventListener(NOTIFICATIONS_CHANGED, fire);
    window.addEventListener('focus', fire);
    const timer = window.setInterval(fire, POLL_MS);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED, fire);
      window.removeEventListener('focus', fire);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fire = () => latest.current();
    const channel = supabase
      .channel(`notifications:${userId}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        fire
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, fire)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, channelId]);
}
