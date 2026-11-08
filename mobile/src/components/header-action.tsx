import { Pressable } from 'react-native';

import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A word in the top app bar's right side — Material's text action there — for something the
 * screen offers that isn't its main job (Arrange). The main job gets the floating button; this
 * stays quiet in the accent. A 48dp target; `accessibilityLabel` names the object when the word
 * alone doesn't ("Arrange" → "Arrange categories").
 */
export function HeaderAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={{ color: colors.primarySoft, borderless: true }}
      style={{ minHeight: TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: SPACE.md }}
    >
      <Text variant="bodyStrong" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}
