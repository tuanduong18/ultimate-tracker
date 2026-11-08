import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { FieldNote } from '@/components/text-field';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A field whose value is chosen rather than typed — a date, a currency — drawn exactly like a
 * `TextField` (label above, outlined box, note below) so a form reads as one column of fields,
 * with a trailing icon that says what opens (a calendar, a list). The whole box is the target.
 *
 * TalkBack hears "Date, 7 Nov 2026, button" and the hint saying what a tap opens.
 */
export function PickerField({
  label,
  value,
  placeholder,
  icon,
  hint,
  error,
  accessibilityHint,
  onPress,
  trailing,
}: {
  label: string;
  /** What is chosen, as words; empty shows `placeholder` in the muted tone. */
  value: string;
  placeholder?: string;
  icon: IconName;
  hint?: string;
  error?: string;
  /** What a tap does ("Opens a calendar"). */
  accessibilityHint: string;
  onPress: () => void;
  /** Beside the box, for a Clear button on an optional field. */
  trailing?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const shown = value || placeholder || '';
  return (
    <View style={{ gap: SPACE.xs }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${shown}`}
          accessibilityHint={error ?? accessibilityHint}
          android_ripple={{ color: colors.primarySoft }}
          style={{
            flex: 1,
            minHeight: TOUCH_TARGET,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACE.sm,
            paddingLeft: SPACE.md - (error ? 1 : 0),
            paddingRight: SPACE.sm,
            borderRadius: RADIUS.control,
            borderWidth: error ? 2 : 1,
            borderColor: error ? colors.negative : colors.borderControl,
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <Text tone={value ? 'fg' : 'fgMuted'} style={{ flex: 1 }} numberOfLines={1}>
            {shown}
          </Text>
          <Icon name={icon} size={22} tone="fgMuted" />
        </Pressable>
        {trailing}
      </View>
      <FieldNote error={error} hint={hint} />
    </View>
  );
}
