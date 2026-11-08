import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card, RowDivider } from '@/components/card';
import { Icon, IconBadge, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The three states a list or a resource shows before (or instead of) its content — the phone's
 * half of the shared rule that every list draws loading, error, empty and populated, and never
 * says "No …" while loading or after a failed load (ux-ui-shared/references/behaviour.md).
 */

/**
 * The first load: grey shapes where the rows will be — a badge and two lines each — so the
 * screen doesn't jump when they arrive. Static, not shimmering: motion here would say nothing,
 * and "Remove animations" would have to switch it off anyway. A refetch never shows this; the
 * old content stays up. TalkBack hears one "Loading…".
 */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  const { colors } = useAppTheme();
  const block = { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.control };
  return (
    <Card
      accessible
      accessibilityLabel="Loading…"
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index}>
          {index > 0 && <RowDivider />}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg }}
          >
            <View style={[block, { width: 40, height: 40, borderRadius: 12 }]} />
            <View style={{ flex: 1, gap: SPACE.sm }}>
              <View style={[block, { height: 14, width: '60%' }]} />
              <View style={[block, { height: 12, width: '35%' }]} />
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}

/**
 * A load that failed, in place of the content it was for and inside that region, with the
 * sentence that says why (`loadError`) and Retry. Announced politely: it answers nothing the
 * person just did, so it shouldn't interrupt.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ padding: SPACE.xl, gap: SPACE.md }}>
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm }}
      >
        <Icon name="error" size={20} tone="negative" style={{ marginTop: 1 }} />
        <Text style={{ flex: 1 }}>{message}</Text>
      </View>
      <Button label="Try again" icon="refresh" onPress={onRetry} />
    </Card>
  );
}

/**
 * Nothing here yet: what will go here, and the action that puts it there — or, for a filtered
 * list, that the filter is why, with the way to clear it. The words come from the web, so an
 * empty list reads the same on both.
 */
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: IconName;
  message: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  return (
    <Card style={{ padding: SPACE.xl, gap: SPACE.lg, alignItems: 'flex-start' }}>
      <IconBadge name={icon} />
      <Text tone="fgMuted">{message}</Text>
      {action && <Button label={action.label} icon={action.icon} onPress={action.onPress} />}
    </Card>
  );
}
