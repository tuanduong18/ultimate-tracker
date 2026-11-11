import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { LogButton } from '@/components/log-button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The top app bar's look, for every stack that pushes ordinary screens: the tabs' stacks and
 * the root stack's Notifications. The bar sits flat on the page colour with no shadow, like the
 * web's header on `bg`.
 */
export function useHeaderOptions() {
  const { colors } = useAppTheme();
  return useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.fg,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.bg },
    }),
    [colors]
  );
}

/**
 * The actions that belong to every module — Log and the bell, the web header's two — on the
 * right of the top bar. The account, the web's third, is the More tab.
 */
export function GlobalActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LogButton />
      <NotificationBell />
    </View>
  );
}

/**
 * The stack inside every tab, with Android's native top app bar as its header.
 *
 * The header carries the screen's title — "Finance", "Insights" — rather than the app's name:
 * on a phone the title is what tells you where you are, and the brand is on the launcher
 * already. A pushed screen (More → Insights) gets the system back arrow here for free.
 *
 * Log and the bell sit on each tab's first screen only (`index`), where the web would show its
 * header: those are the places people start from. A pushed screen keeps its bar for its own
 * actions (Arrange) beside the back arrow — three actions and a title would crowd a phone's bar —
 * and the bell is one back gesture away.
 */
export function TabStack() {
  const header = useHeaderOptions();
  return (
    <Stack
      screenOptions={({ route }) => ({
        ...header,
        headerRight: route.name === 'index' ? () => <GlobalActions /> : undefined,
      })}
    />
  );
}
