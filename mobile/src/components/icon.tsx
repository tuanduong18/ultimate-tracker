import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/theme-provider';
import type { Colors } from '@/theme/themes';

/** A Material Symbols name, as the tab bar and SymbolView take it on Android. */
export type IconName = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], object>['android']
>;

/**
 * A Material Symbol — Android's own icon set, so icons look like the rest of the phone rather
 * than like the web's. Always decorative: the control around it carries the accessible name,
 * so the glyph is hidden from screen readers.
 */
export function Icon({
  name,
  size = 24,
  tone = 'fg',
  style,
}: {
  name: IconName;
  size?: number;
  tone?: keyof Colors;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={style}>
      <SymbolView name={{ android: name }} size={size} tintColor={colors[tone]} />
    </View>
  );
}

/**
 * An icon in a soft square of the accent — the web's IconBadge. For a module's identity on a
 * placeholder or a list row, never as a control.
 */
export function IconBadge({ name, size = 'md' }: { name: IconName; size?: 'md' | 'lg' }) {
  const { colors } = useAppTheme();
  const box = size === 'lg' ? 64 : 40;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: size === 'lg' ? 16 : 10,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={size === 'lg' ? 32 : 22} tone="primary" />
    </View>
  );
}
