import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { initialOf } from '@/lib/finance/categories';
import { CATEGORY_SYMBOLS } from '@/lib/finance/category-symbols';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Which symbol a category's badge draws — the phone's twin of the web's SymbolPicker: a grid of
 * every symbol on the shared list, with "No symbol" first, which previews the initial.
 *
 * A grid because the options are pictures and the point is to see them all at once. Each tile is
 * a radio button named after its symbol, so TalkBack reads "Groceries, radio button, checked";
 * the chosen tile is filled `primarySoft` with a `primary` edge — shape and tint, not tint
 * alone. Tiles are the full 48dp target, 8dp apart, and wrap at any width or font size.
 */
export function SymbolPicker({
  value,
  onChange,
  name,
}: {
  /** The chosen key, or null for none. */
  value: string | null;
  onChange: (key: string | null) => void;
  /** The category's name, for the initial the "No symbol" tile previews. */
  name: string;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        Symbol
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Symbol"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}
      >
        <Tile
          label="No symbol — show the initial"
          chosen={value === null}
          onPress={() => onChange(null)}
        >
          <Text variant="bodyStrong" maxFontSizeMultiplier={1.3}>
            {initialOf(name || '?')}
          </Text>
        </Tile>
        {CATEGORY_SYMBOLS.map((symbol) => (
          <Tile
            key={symbol.key}
            label={symbol.label}
            chosen={value === symbol.key}
            onPress={() => onChange(symbol.key)}
          >
            <Icon name={symbol.icon} size={22} />
          </Tile>
        ))}
      </View>
    </View>
  );
}

function Tile({
  label,
  chosen,
  onPress,
  children,
}: {
  label: string;
  chosen: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: chosen }}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: chosen ? 2 : 1,
        borderColor: chosen ? colors.primary : colors.border,
        backgroundColor: chosen ? colors.primarySoft : colors.surface,
        overflow: 'hidden',
      }}
    >
      <View importantForAccessibility="no-hide-descendants">{children}</View>
    </Pressable>
  );
}
