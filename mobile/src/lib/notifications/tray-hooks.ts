import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { api } from '@/lib/api-client';
import { registerTraySync } from '@/lib/notifications/background-sync';
import { needsBackgroundSetup } from '@/lib/notifications/background-setup';
import { CATEGORY_OF } from '@/lib/notifications/categories';
import { linkFor, type NotificationKind } from '@/lib/notifications/notifications';
import { notificationKeys, useInbox } from '@/lib/notifications/queries';
import { clearTray, syncTray } from '@/lib/notifications/sync';
import {
  rememberAsked,
  rememberSetupOffered,
  wasAsked,
  wasSetupOffered,
} from '@/lib/notifications/tray-store';

/**
 * The tray's ties to the running app. Mounted under the tabs, where someone is signed in
 * (`useTraySync`, `useNotificationSetup`), or at the root, where the session is decided
 * (`useTrayTaps`, `useClearTrayWhenSignedOut`).
 */

/**
 * Sync whenever the bell's inbox reloads — at launch, coming back to the front, Realtime, the
 * five-minute poll, a save, a pull to refresh — reusing what it loaded rather than asking the
 * server twice. Also registers the hourly background run.
 */
export function useTraySync(): void {
  const inbox = useInbox();

  useEffect(() => {
    registerTraySync().catch(() => {
      // Android refused it (rare): the tray still syncs whenever the app is open.
    });
  }, []);

  useEffect(() => {
    if (!inbox.data) return;
    void syncTray({ inbox: inbox.data, appOpen: AppState.currentState === 'active' });
    // dataUpdatedAt changes on every successful load, even when the rows are the same.
  }, [inbox.data, inbox.dataUpdatedAt]);
}

/**
 * Tapping a notification opens what it is about — a reminder Subscriptions, a renewal
 * Transactions, a budget alert Budgets, a currency notice Profile — and marks its row read, as
 * opening the inbox does. Works whether the app was closed, behind, or in front.
 *
 * Tapped while signed out, it leads to sign-in and then the dashboard (the guard's default), not
 * to the subject: rare, and not worth carrying a destination through sign-in. Marking read is
 * best-effort: offline, or a row already gone, it fails quietly and the screen opens anyway.
 */
export function useTrayTaps(ready: boolean, signedIn: boolean): void {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;
    const open = (response: Notifications.NotificationResponse) => {
      const { rowId, kind } = response.notification.request.content.data ?? {};
      if (typeof rowId !== 'string' || typeof kind !== 'string' || !(kind in CATEGORY_OF)) return;
      // Handled once: a later sign-in must not replay it.
      Notifications.clearLastNotificationResponse();
      if (!signedIn) return;
      router.navigate(linkFor(kind as NotificationKind).href);
      void api
        .patch(`/notifications/${rowId}`, { read: true })
        .catch(() => undefined)
        .finally(() => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }));
    };
    // The tap that opened the app from closed arrives before this listener exists.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready, signedIn, router, queryClient]);
}

/**
 * Signed out — by Log out, a 401, or a session that expired while the app was closed — the tray
 * forgets this person: nothing scheduled from their rows, nothing of theirs in the tray, no marks.
 */
export function useClearTrayWhenSignedOut(ready: boolean, signedIn: boolean): void {
  useEffect(() => {
    if (ready && !signedIn) void clearTray().catch(() => undefined);
  }, [ready, signedIn]);
}

/**
 * After sign-in, once per app: the permission, asked with one line saying why — then, on a phone
 * that stops background work, the offer of the background setup. Each is asked once and
 * remembered; both stay reachable from Settings → Notifications.
 *
 * Android's own dialogs (`Alert`), as for confirmations: the person has met them before, and
 * TalkBack handles them. Not `confirm()`, which only reports a "yes".
 */
export function useNotificationSetup(): void {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void (async () => {
      await askForPermissionOnce();
      if (active) await offerBackgroundSetupOnce(() => router.push('/more/background-setup'));
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);
}

async function askForPermissionOnce(): Promise<void> {
  if (await wasAsked()) return;
  await rememberAsked();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === Notifications.PermissionStatus.GRANTED) return;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'Get reminders on this phone?',
      'Subscription reminders and budget alerts can reach your notifications, even with the app closed.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Continue',
          onPress: () =>
            void Notifications.requestPermissionsAsync()
              .catch(() => undefined)
              .finally(resolve),
        },
      ],
      { cancelable: true, onDismiss: () => resolve() }
    );
  });
}

async function offerBackgroundSetupOnce(openSetup: () => void): Promise<void> {
  if ((await wasSetupOffered()) || !(await needsBackgroundSetup())) return;
  await rememberSetupOffered();
  Alert.alert(
    'Keep notifications coming',
    'This phone stops apps working in the background unless two settings are on. It takes a minute.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Show me', onPress: openSetup },
    ],
    { cancelable: true }
  );
}
