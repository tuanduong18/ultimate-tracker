import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { initialOf } from '@/lib/finance/categories';
import { symbolFor } from '@/lib/finance/category-symbols';
import { inkOn, NEUTRAL_COLOUR } from '@/lib/tint';

const SIZES = {
  md: { box: 40, radius: 12, glyph: 22, variant: 'heading' },
  sm: { box: 24, radius: 6, glyph: 16, variant: 'label' },
} as const;

/**
 * A row's leading badge — the twin of the web's CategoryBadge: the category's own colour, solid,
 * with its symbol on it (Food → a knife and fork), like an app icon on a bank statement. The
 * quickest way down a list is by shape and colour, before reading.
 *
 * Without a symbol — or with a key this app doesn't know yet — it shows the initial instead.
 * Subscriptions pass no `icon` on purpose: their badge shows the service's initial ("N" for
 * Netflix), which tells one from another where a shared Subscriptions symbol would make them all
 * alike.
 *
 * The colour is the category's in both modes, the same as its slice in the chart, so a category
 * looks the same everywhere. The glyph takes pure white or black by `inkOn`, whichever contrasts
 * more — at least 4.58:1 on any colour a person can pick. The row names the category in words
 * too, so neither colour nor symbol carries meaning alone — which is why TalkBack skips it.
 *
 * `sm` (24dp) is for chips and legends, where it stands for the category beside its name.
 *
 * The initial grows with the font size only to 1.3×: it sits in a fixed box, is hidden from
 * TalkBack, and the name beside it scales fully, so capping it loses nothing anyone reads.
 */
export function CategoryBadge({
  colour,
  name,
  icon,
  size = 'md',
}: {
  colour: string | null | undefined;
  /** What the fallback initial is taken from: the category, or the subscription. */
  name: string;
  icon?: string | null;
  size?: keyof typeof SIZES;
}) {
  const background = colour ?? NEUTRAL_COLOUR;
  const ink = inkOn(background);
  const symbol = symbolFor(icon);
  const { box, radius, glyph, variant } = SIZES[size];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={symbol ? `symbol-${symbol.key}` : undefined}
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {symbol ? (
        <Icon name={symbol.icon} size={glyph} ink={ink} />
      ) : (
        <Text variant={variant} style={{ color: ink }} maxFontSizeMultiplier={1.3}>
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
}
