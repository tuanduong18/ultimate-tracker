import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { confirm } from '@/components/confirm';
import { FormError } from '@/components/form-error';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { describeError } from '@/lib/describe-error';
import {
  archiveLabel,
  isReminder,
  linkFor,
  type AppNotification,
  type NotificationChange,
  type NotificationKind,
} from '@/lib/notifications/notifications';
import { useNotificationChange } from '@/lib/notifications/queries';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

const ICONS: Record<NotificationKind, IconName> = {
  subscription_renewal: 'notifications_active',
  trial_ending: 'notifications_active',
  subscription_renewed: 'receipt_long',
  currency_delisted: 'currency_exchange',
  budget_warning: 'speed',
  budget_exceeded: 'warning',
};

/**
 * One notification, with what can be done about it where it is shown — the twin of the web's
 * NotificationItem, with the same actions in the same words:
 *
 * - In the inbox, a reminder can be snoozed ("I'm renewing anyway"), a notice moved to the
 *   history (Got it / Move to history).
 * - In the history, a snoozed reminder can be unsnoozed, in case it was pressed by mistake, and a
 *   notice deleted — after Android's confirm dialog, the phone's rule for anything that can't be
 *   taken back.
 * - Each also opens where it can be acted on — the subscriptions, the transactions, the budgets,
 *   the profile — as its own button rather than by tapping the row, so a row that also holds
 *   buttons never has two meanings for one tap.
 *
 * Every action goes to the server and then reloads, rather than changing the row in place, so
 * what is shown is what was stored. A failure stays under the row until the next try.
 *
 * Unread when the screen opened: a dot on the icon, and "New" for TalkBack — never colour alone.
 * Snoozed and archived rows say so in words rather than fading: a faded row's text would fall
 * below a readable contrast.
 */
export function NotificationRow({
  notification,
  fresh = false,
}: {
  notification: AppNotification;
  fresh?: boolean;
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const change = useNotificationChange();
  const [error, setError] = useState<string | null>(null);
  const reminder = isReminder(notification);
  const snoozed = notification.snoozed_at !== null;
  const archived = notification.archived_at !== null;
  const link = linkFor(notification.kind);
  const busy = change.isPending;

  async function run(what: NotificationChange) {
    setError(null);
    try {
      await change.mutateAsync({ id: notification.id, change: what });
    } catch (err) {
      setError(describeError(err, 'Could not update this notification.'));
    }
  }

  function askToDelete() {
    confirm({
      title: 'Delete this notification?',
      message: `${notification.title}. This can’t be undone.`,
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm: () => void run('delete'),
    });
  }

  return (
    <View style={{ flexDirection: 'row', gap: SPACE.md, padding: SPACE.lg }}>
      <View
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 40,
          height: 40,
          borderRadius: RADIUS.pill,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={snoozed ? 'notifications_off' : ICONS[notification.kind]} size={20} />
        {fresh && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: colors.surface,
              backgroundColor: colors.primary,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: SPACE.xs }}>
        {/* A header, so TalkBack's headings navigation steps from one notification to the next. */}
        <Text
          variant="bodyStrong"
          accessibilityRole="header"
          accessibilityLabel={fresh ? `New: ${notification.title}` : undefined}
        >
          {notification.title}
        </Text>
        <Text tone="fgMuted">{notification.body}</Text>
        {snoozed && (
          <Text variant="caption" tone="fgMuted">
            Snoozed — it won’t come back unless you edit the subscription.
          </Text>
        )}

        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm }}
        >
          {reminder && !snoozed && (
            <Button label="Snooze" disabled={busy} onPress={() => void run({ snoozed: true })} />
          )}
          {reminder && snoozed && (
            <Button label="Unsnooze" disabled={busy} onPress={() => void run({ snoozed: false })} />
          )}
          {!reminder && !archived && (
            <Button
              label={archiveLabel(notification.kind)}
              disabled={busy}
              onPress={() => void run({ archived: true })}
            />
          )}
          {!reminder && archived && (
            <Button label="Delete" variant="danger" disabled={busy} onPress={askToDelete} />
          )}
          <Button
            label={link.label}
            variant="text"
            accessibilityRole="link"
            // From above the tabs: close Notifications and open the screen in its own tab, so
            // back from there goes up that tab's stack rather than into a second set of tabs.
            onPress={() => router.dismissTo(link.href)}
          />
        </View>

        {error ? <FormError message={error} /> : null}
      </View>
    </View>
  );
}
