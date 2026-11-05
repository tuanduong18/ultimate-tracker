import { Pressable, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The filled primary button — one per card or screen region, as on the web. At least 48dp tall
 * (Android's touch target), with Android's ripple as the press feedback rather than an opacity
 * fade, so it answers a tap the way the rest of the phone does.
 */
export function PrimaryButton({
  label,
  icon,
  ...props
}: Omit<PressableProps, 'children'> & { label: string; icon?: IconName }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: colors.primarySoft }}
      {...props}
      style={{
        minHeight: TOUCH_TARGET,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.sm,
        paddingHorizontal: SPACE.lg,
        borderRadius: RADIUS.control,
        backgroundColor: colors.primary,
        overflow: 'hidden',
      }}
    >
      <Text variant="bodyStrong" style={{ color: colors.primaryFg }}>
        {label}
      </Text>
      {icon && <Icon name={icon} size={18} tone="primaryFg" />}
    </Pressable>
  );
}
