import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { badgeText } from '@/lib/notifications/notifications';
import { useInbox } from '@/lib/notifications/queries';
import { RADIUS, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The bell in the top app bar — the twin of the web's header bell: the inbox's unread count on a
 * badge, and a tap that opens Notifications.
 *
 * A screen rather than the web's dropdown panel: Android has no popover of that size, and a
 * screen gets the back gesture, TalkBack's order and room for each row's actions for free.
 * Opening it marks the inbox read, as opening the web's panel does, which clears the badge.
 *
 * The count comes from the shared inbox query, which Realtime keeps current
 * (useNotificationUpdates, under the tabs) — so the bell on every tab agrees without each one
 * listening. The badge is the accent, with a number in words for TalkBack ("Notifications, 3
 * new"); with nothing new there is no badge at all, not a zero.
 */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const inbox = useInbox();
  const unread = (inbox.data ?? []).filter((n) => n.read_at === null).length;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
      android_ripple={{ color: colors.primarySoft, borderless: true, radius: TOUCH_TARGET / 2 }}
      style={{
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={unread > 0 ? 'notifications_unread' : 'notifications'} />
      {unread > 0 && (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: 6,
            right: 4,
            minWidth: 18,
            paddingHorizontal: 4,
            borderRadius: RADIUS.pill,
            borderWidth: 2,
            borderColor: colors.bg,
            backgroundColor: colors.primary,
            alignItems: 'center',
          }}
        >
          {/* Capped at 1.3× so a large system font can't push the badge off the bell. */}
          <Text
            variant="label"
            maxFontSizeMultiplier={1.3}
            style={{ color: colors.primaryFg, fontWeight: '700' }}
          >
            {badgeText(unread)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
