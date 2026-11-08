import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { FAB_CLEARANCE } from '@/components/fab';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The scrolling body of a screen: the page background, 16dp padding, and room at the bottom.
 * The header above and the tab bar below are native and inset the content themselves, so a
 * screen never measures the status bar or the tab bar by hand.
 *
 * `onRefresh` adds Android's pull-to-refresh, spinning in the accent only while the pull it
 * started is running — a refetch the app does on its own (coming back to the front) keeps the
 * old content up silently instead. `withFab` leaves room under the content for the floating
 * button, so it never sits over the last row.
 */
export function Screen({
  children,
  onRefresh,
  withFab = false,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  withFab?: boolean;
}) {
  const { colors } = useAppTheme();
  const refresh = usePullToRefresh(onRefresh);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: SPACE.lg,
        paddingBottom: withFab ? FAB_CLEARANCE : SPACE.xxl,
        gap: SPACE.lg,
      }}
      refreshControl={refresh}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Android's pull-to-refresh for any scrolling list, or nothing without `onRefresh`. The spinner
 * shows only while the pull the person started is running.
 */
export function usePullToRefresh(onRefresh?: () => Promise<unknown>) {
  const { colors } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  if (!onRefresh) return undefined;
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}
