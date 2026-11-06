import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A row that does something here rather than opening a screen (Log out): an icon and a verb,
 * and no chevron — the chevron is `NavRow`'s promise that a tap goes somewhere. The whole row
 * is the target, at least 56dp.
 */
export function ActionRow({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: TOUCH_TARGET + SPACE.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={icon} tone="fgMuted" />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
