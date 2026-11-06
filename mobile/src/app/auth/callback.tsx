import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { completeSignIn, type AuthRedirect } from '@/auth/google';
import { Text } from '@/components/text';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Where a browser sign-in lands: `ultimatetracker://auth/callback` (or Expo Go's `exp://` twin)
 * opens this route, carrying a one-time code or the reason it failed.
 *
 * It finishes the sign-in itself, so a confirmation link from a sign-up email works too — not
 * only Google, whose browser sheet also hands the code back to the log-in screen (the exchange
 * runs once either way; see completeSignIn). Then it leaves: to the start, which sends a
 * signed-in user to their tabs, or back to Log in with the reason.
 */
export default function AuthCallback() {
  const {
    code,
    error,
    error_description: description,
  } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();

  useEffect(() => {
    const redirect: AuthRedirect =
      error || description
        ? {
            kind: 'error',
            message: description ?? error ?? '',
            cancelled: error === 'access_denied',
          }
        : code
          ? { kind: 'code', code }
          : null;

    let active = true;
    void completeSignIn(redirect).then((outcome) => {
      if (!active) return;
      if (outcome.error) router.replace({ pathname: '/login', params: { error: outcome.error } });
      else router.replace('/');
    });
    return () => {
      active = false;
    };
  }, [code, error, description, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.md,
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text tone="fgMuted" accessibilityLiveRegion="polite">
        Signing you in…
      </Text>
    </View>
  );
}
