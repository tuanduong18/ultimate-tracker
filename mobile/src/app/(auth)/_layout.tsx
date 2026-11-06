import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme-provider';

/** Log in and Sign up: a stack with no top bar — `AuthScreen` carries the title itself. */
export default function AuthLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
