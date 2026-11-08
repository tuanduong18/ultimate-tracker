import type { ReactNode } from 'react';
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

/**
 * One row of a card that a virtualised list draws a row at a time (Transactions, where a single
 * `Card` around hundreds of rows would render them all): the first row takes the card's top edge
 * and corners, the last its bottom ones, and every row but the last ends in the divider hairline,
 * so the rows read as one card.
 */
export function CardListItem({
  index,
  count,
  children,
}: {
  index: number;
  count: number;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const first = index === 0;
  const last = index === count - 1;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderBottomWidth: 1,
        borderTopLeftRadius: first ? RADIUS.card : 0,
        borderTopRightRadius: first ? RADIUS.card : 0,
        borderBottomLeftRadius: last ? RADIUS.card : 0,
        borderBottomRightRadius: last ? RADIUS.card : 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
