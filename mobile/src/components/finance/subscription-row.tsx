import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/button';
import { CategoryBadge } from '@/components/finance/category-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { UNCATEGORISED } from '@/lib/finance/categories';
import { formatInterval, hasEnded, nextStep, renewable } from '@/lib/finance/subscriptions';
import type { Category, Subscription } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * One subscription — the phone's twin of the web's subscription row: the service's initial on
 * its category's colour (no shared Subscriptions symbol, which would make every badge alike), its
 * name, what it costs and how often, what happens next and under which category.
 *
 * A charge within three days stands out in words, with a bell, in `negative` — never by colour
 * alone. One that has ended reads quieter. Renew now sits beside the row as its own button, not
 * inside it, so TalkBack reaches both; it's left out where a cancellation stops the next charge,
 * since the API would refuse it. `note` is what the last renewal or failure said, kept on the row
 * until the next action, as on the web.
 */
export function SubscriptionRow({
  subscription,
  category,
  today,
  onOpen,
  onRenew,
  renewing,
  note,
}: {
  subscription: Subscription;
  category: Category | undefined;
  today: string;
  onOpen: () => void;
  onRenew: () => void;
  renewing: boolean;
  note?: { tone: 'done' | 'error'; text: string };
}) {
  const { colors } = useAppTheme();
  const ended = hasEnded(subscription, today);
  const step = nextStep(subscription, today);
  const money = formatMoney(subscription.amount, subscription.currency);
  const every = formatInterval(subscription.interval_unit, subscription.interval_count);
  const categoryName = category?.name ?? UNCATEGORISED;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: SPACE.xs }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${subscription.name}, ${money} every ${every}. ${step.text}. ${categoryName}.`}
          accessibilityHint="Opens it to edit or cancel"
          android_ripple={{ color: colors.primarySoft }}
          style={{
            flex: 1,
            minHeight: TOUCH_TARGET + SPACE.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACE.md,
            paddingLeft: SPACE.lg,
            paddingRight: SPACE.sm,
            paddingVertical: SPACE.md,
            opacity: ended ? 0.7 : 1,
          }}
        >
          <CategoryBadge colour={category?.colour ?? null} name={subscription.name} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="bodyStrong" tone={ended ? 'fgMuted' : 'fg'}>
              {subscription.name}
            </Text>
            <Text variant="caption" tone="fgMuted" style={{ fontVariant: ['tabular-nums'] }}>
              {money} / {every}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
              {step.soon && <Icon name="notifications_active" size={14} tone="negative" />}
              <Text
                variant="caption"
                tone={step.soon ? 'negative' : 'fgMuted'}
                style={[{ flexShrink: 1 }, step.soon && { fontWeight: '600' }]}
              >
                {step.text} · {categoryName}
              </Text>
            </View>
          </View>
        </Pressable>
        {renewable(subscription) && !ended && (
          <IconButton
            icon="event_available"
            label={`Renew ${subscription.name} now`}
            tone="primary"
            disabled={renewing}
            onPress={onRenew}
          />
        )}
      </View>
      {note ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            gap: SPACE.xs,
            paddingHorizontal: SPACE.lg,
            paddingBottom: SPACE.md,
          }}
        >
          <Icon
            name={note.tone === 'done' ? 'check_circle' : 'error'}
            size={16}
            tone={note.tone === 'done' ? 'positive' : 'negative'}
          />
          <Text
            variant="caption"
            tone={note.tone === 'done' ? 'positive' : 'negative'}
            style={{ flex: 1 }}
          >
            {note.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
