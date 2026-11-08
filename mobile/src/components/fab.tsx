import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/** How much a list leaves under its last row so the button never covers it. */
export const FAB_CLEARANCE = 56 + SPACE.lg * 2;

/**
 * Material's extended floating action button: the one thing a screen exists to let you do
 * (Add expense, New budget), as an icon and a verb, low on the right where the thumb is.
 *
 * Chosen over a top-bar action because logging happens one-handed and on the move, and the top
 * corner of a 6.7-inch screen is the hardest place to reach. Extended — with its words — rather
 * than an icon alone, because "+" on a list of budgets could mean a budget or an expense. Filled
 * in `primary` like the primary button, and the only thing in the app with a shadow: it floats
 * over the list, and the shadow is what says it isn't part of it.
 *
 * The screen leaves `FAB_CLEARANCE` under its last row, so nothing hides behind it.
 */
export function Fab({
  label,
  icon = 'add',
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** When the visible verb is shorter than the action ("New" → "New category"). */
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        position: 'absolute',
        right: SPACE.lg,
        bottom: SPACE.lg,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.sm,
        paddingLeft: SPACE.lg,
        paddingRight: SPACE.xl,
        borderRadius: 16,
        backgroundColor: colors.primary,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <Icon name={icon} tone="primaryFg" />
      <Text variant="bodyStrong" style={{ color: colors.primaryFg }}>
        {label}
      </Text>
    </Pressable>
  );
}
