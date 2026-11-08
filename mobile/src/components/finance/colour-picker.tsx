import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { CATEGORY_COLOURS, colourName } from '@/lib/finance/category-colours';
import { inkOn } from '@/lib/tint';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A category's colour, from the phone's palette (lib/finance/category-colours.ts) — the twin of
 * the web's colour input, which is a free picker Android has no native version of.
 *
 * Round swatches, each a radio button named after its colour ("Teal"), so the choice is spoken,
 * not only seen. The chosen one gets a tick in white or black by `inkOn` and a ring in the page's
 * own ink — the ring because a tick alone is easy to miss on a pale yellow. A colour from the web
 * that isn't on the palette comes first, as "Current colour", so it is kept unless changed.
 */
export function ColourPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const known = colourName(value) !== null;
  const swatches = known
    ? CATEGORY_COLOURS
    : [{ hex: value, name: 'Current colour' }, ...CATEGORY_COLOURS];

  return (
    <View style={{ gap: SPACE.sm }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        Colour
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Colour"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}
      >
        {swatches.map((swatch) => (
          <Swatch
            key={swatch.hex}
            hex={swatch.hex}
            name={swatch.name}
            chosen={swatch.hex.toLowerCase() === value.toLowerCase()}
            onPress={() => onChange(swatch.hex)}
          />
        ))}
      </View>
    </View>
  );
}

function Swatch({
  hex,
  name,
  chosen,
  onPress,
}: {
  hex: string;
  name: string;
  chosen: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: chosen }}
      android_ripple={{ color: colors.primarySoft, borderless: true, radius: TOUCH_TARGET / 2 }}
      style={{
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: TOUCH_TARGET / 2,
        borderWidth: 2,
        borderColor: chosen ? colors.fg : 'transparent',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: hex,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {chosen && <Icon name="check" size={20} ink={inkOn(hex)} />}
      </View>
    </Pressable>
  );
}
