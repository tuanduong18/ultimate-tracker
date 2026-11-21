import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { profileKey } from '@/lib/finance/queries';
import type { MutableCategory } from '@/lib/notifications/categories';
import { notificationKeys } from '@/lib/notifications/keys';
import type { Profile } from '@/lib/types/profile';

/**
 * Saving the account's notification switches: the whole list of categories turned off
 * (PATCH /auth/me replaces it), then a reload of the profile and of the notifications — turning
 * Subscription reminders off deletes the live ones on the server, and the tray follows the inbox.
 *
 * `networkMode: 'always'` is the one exception to how the app's saves behave offline
 * (ADR-0006): everywhere else a save waits on screen for the connection, but a switch applies
 * the moment it is flipped, and one that looks flipped while nothing was saved would mislead. So
 * this one runs at once, fails at once with no connection, and the switch flips back.
 */
export function useMutedWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (muted: MutableCategory[]) =>
      api.patch<Profile>('/auth/me', { muted_notifications: muted }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKey }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
      ]),
  });
}
