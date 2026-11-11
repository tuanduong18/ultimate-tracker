import { Pressable, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * One yes-or-no choice that applies to the screen it's on (Also import the duplicates): its words
 * and a line saying what it means, with Android's own Material switch at the end — the web's
 * checkbox, drawn the way the phone draws a toggle.
 *
 * The whole row is the target, not just the switch, and TalkBack hears one `switch` with its
 * state and the description as its hint. The track is `primary` when on and `borderControl`
 * when off (≥ 3:1, measured), so the state shows in shape and position as well as colour.
 */
export function SwitchRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
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
      <View style={{ flex: 1, minWidth: 0, gap: SPACE.xs }} importantForAccessibility="no">
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="fgMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        importantForAccessibility="no"
        trackColor={{ false: colors.borderControl, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </Pressable>
  );
}
