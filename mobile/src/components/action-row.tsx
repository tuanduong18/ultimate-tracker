import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A row that does something here rather than opening a screen (Log out, a choice in the Log
 * sheet): an icon and a verb, with an optional line under it saying what it is for, and no
 * chevron — the chevron is `NavRow`'s promise that a tap goes somewhere. The whole row is the
 * target, at least 56dp.
 */
export function ActionRow({
  label,
  blurb,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  blurb?: string;
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
      accessibilityLabel={blurb ? `${label}, ${blurb}` : label}
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong">{label}</Text>
        {blurb ? (
          <Text variant="caption" tone="fgMuted">
            {blurb}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
