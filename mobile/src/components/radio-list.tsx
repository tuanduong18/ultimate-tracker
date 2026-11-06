import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * One choice from a short list, the way Android's own settings ask it: rows in a card, each with
 * a radio button — the twin of the web's radio cards. Rows rather than a grid of tiles, so a long
 * label or the largest font size wraps instead of breaking a column.
 *
 * The chosen row is marked by the radio's filled dot, a change of shape, not by a tint alone.
 * TalkBack hears each row as a radio button, checked or not, inside a group named by `label`.
 */
export function RadioList({ label, children }: { label: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Card accessibilityRole="radiogroup" accessibilityLabel={label}>
      {rows.map((row, index) => (
        <View key={row.key ?? index}>
          {index > 0 && <RowDivider />}
          {row}
        </View>
      ))}
    </Card>
  );
}

/**
 * A row in a `RadioList`: something that shows the option (an icon, swatches), its name, an
 * optional one-line description, and the radio. The whole row is the target, at least 56dp.
 */
export function RadioRow({
  label,
  description,
  selected,
  onSelect,
  leading,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  leading?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={description}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: TOUCH_TARGET + SPACE.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }} importantForAccessibility="no-hide-descendants">
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="fgMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <RadioMark selected={selected} />
    </Pressable>
  );
}

/** Material's radio: a 20dp ring, `primary` with a filled dot when chosen, `borderControl` (≥ 3:1) when not. */
function RadioMark({ selected }: { selected: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.borderControl,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
      )}
    </View>
  );
}
