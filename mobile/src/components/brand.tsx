import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Text } from '@/components/text';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The Ultimate Tracker mark — a rising trend line ending in a dot, on a rounded tile — the same
 * drawing as the web's LogoMark. Drawn in the theme's accent so it re-colours with the scheme;
 * the launcher icon is the same drawing frozen in the default blue, since the launcher cannot
 * read the app's theme.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
      <Rect width={32} height={32} rx={9} fill={colors.primary} />
      <Path
        d="M7.5 21.5 12.5 15.5 17 19 24.5 10.5"
        fill="none"
        stroke={colors.primaryFg}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={24.5} cy={10.5} r={3} fill={colors.primaryFg} />
    </Svg>
  );
}

/** Mark and name together. The name is real text, so it is read out and scales with font size. */
export function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark />
      <Text variant="heading">
        Ultimate{' '}
        <Text variant="heading" tone="primary">
          Tracker
        </Text>
      </Text>
    </View>
  );
}
