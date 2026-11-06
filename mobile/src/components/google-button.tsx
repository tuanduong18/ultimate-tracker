import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Google's four-colour "G", as its sign-in branding guidelines require — the same drawing as
 * the web's. The one place hex sits in a component: these are Google's colours, not ours, and
 * they don't change with the scheme or the mode.
 */
function GoogleMark() {
  return (
    <Svg viewBox="0 0 48 48" width={20} height={20}>
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
}

/**
 * "Continue with Google", for both log-in and sign-up — with a provider there is no
 * difference: the first sign-in creates the account, and Supabase links it to an existing
 * email account with the same address. Outlined, not filled: the filled button on the screen
 * is the email form's, and two filled buttons would compete.
 */
export function GoogleButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        borderRadius: RADIUS.control,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: busy ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      <GoogleMark />
      <Text variant="bodyStrong">{busy ? 'Opening Google…' : 'Continue with Google'}</Text>
    </Pressable>
  );
}
