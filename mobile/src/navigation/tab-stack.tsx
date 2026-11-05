import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme-provider';

/**
 * The stack inside every tab, with Android's native top app bar as its header.
 *
 * The header carries the screen's title — "Finance", "Insights" — rather than the app's name:
 * on a phone the title is what tells you where you are, and the brand is on the launcher
 * already. A pushed screen (More → Insights) gets the system back arrow here for free. The bar
 * sits flat on the page colour with no shadow, like the web's header on `bg`; the global
 * actions (Log, the bell, the account) join it on the right as their features arrive.
 */
export function TabStack() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.fg,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
