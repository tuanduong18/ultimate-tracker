import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Why the thing you just tried didn't work — the twin of the web's `role="alert"` strip, placed
 * right under the button that caused it and kept until you try again.
 *
 * `negative` text on `negativeSoft` (4.75:1, measured), with an icon so the colour isn't the
 * only signal. Announced assertively: it answers the action the person just took.
 */
export function FormError({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACE.sm,
        padding: SPACE.md,
        borderRadius: RADIUS.control,
        backgroundColor: colors.negativeSoft,
      }}
    >
      <Icon name="error" size={20} tone="negative" />
      <Text tone="negative" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
