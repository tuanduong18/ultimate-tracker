import { View, type ViewProps } from 'react-native';

import { RADIUS } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A card: `surface` with a 1dp `border` and the 16dp radius, as on the web — and no shadow,
 * because elevation reads as a lighter surface in dark mode and fights the flat neutral
 * canvas. Clipped, so ripples and row dividers stop at the rounded corners.
 *
 * Padding is the caller's: a list of rows wants none, a block of content wants 20.
 */
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: RADIUS.card,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}

/** A hairline between rows inside a card. */
export function RowDivider() {
  const { colors } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
