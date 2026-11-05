import { Text as RNText, type TextProps } from 'react-native';

import { TYPE, type TypeVariant } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

type Tone = 'fg' | 'fgMuted' | 'primary' | 'negative' | 'positive';

/**
 * All text in the app. A variant from the type scale and a tone from the theme, so no screen
 * sets a font size or a colour by hand — the drift between hand-written styles is what makes
 * an app feel assembled rather than designed. Font scaling stays on: someone who has asked
 * their phone for bigger text gets it.
 */
export function Text({
  variant = 'body',
  tone = 'fg',
  style,
  ...props
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  const { colors } = useAppTheme();
  return <RNText {...props} style={[TYPE[variant], { color: colors[tone] }, style]} />;
}
