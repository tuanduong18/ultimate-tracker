import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { IconButton } from '@/components/button';
import { useAppTheme } from '@/theme/theme-provider';

/** Every add-or-edit screen, registered in the root stack above the tabs (src/app/(forms)). */
export const FORM_ROUTES = [
  '(forms)/expense',
  '(forms)/category',
  '(forms)/arrange-categories',
] as const;

/**
 * Closing a form: ✕ rather than a back arrow, because a full-screen modal is left, not gone back
 * through. It goes back like system back does, so a form with typed changes still asks first.
 */
function CloseButton() {
  const router = useRouter();
  return <IconButton icon="close" label="Close" onPress={() => router.back()} />;
}

/**
 * How a form opens: Material's full-screen dialog — a modal over the tabs, rising from the
 * bottom, with ✕ and the title in a flat top bar on the page colour (the tabs' bar, minus the
 * back arrow). Declared on the root stack rather than set by each screen, so the opening
 * animation already knows it is a modal.
 */
export function useFormScreenOptions() {
  const { colors } = useAppTheme();
  return useMemo(
    () => ({
      presentation: 'modal' as const,
      headerShown: true,
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.fg,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.bg },
      headerLeft: () => <CloseButton />,
    }),
    [colors]
  );
}
