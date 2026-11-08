import { Pressable } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A filter over a list, as a chip that says what it is set to ("Last month", "Categories · 2
 * hidden") and opens a sheet to change it — Material's filter chip with a menu. The words carry
 * the state, so a filtered list never looks like an unfiltered one; an active filter is also
 * filled `primarySoft` with a `primary` edge, never colour alone. 40dp tall with hit slop to 48.
 */
export function FilterButton({
  label,
  kind,
  active,
  onPress,
}: {
  /** What the filter is set to, as the chip shows it. */
  label: string;
  /** Which filter it is, for TalkBack: "Dates", "Categories", "Amount". */
  kind: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kind}: ${label}`}
      accessibilityHint="Opens the filter"
      hitSlop={4}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.xs,
        paddingLeft: SPACE.md,
        paddingRight: SPACE.sm,
        borderRadius: RADIUS.control,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.borderControl,
        backgroundColor: active ? colors.primarySoft : colors.surface,
        overflow: 'hidden',
      }}
    >
      <Text numberOfLines={1}>{label}</Text>
      <Icon name="expand_more" size={20} tone="fgMuted" />
    </Pressable>
  );
}
