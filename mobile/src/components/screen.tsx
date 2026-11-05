import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The scrolling body of a screen: the page background, 16dp padding, and room at the bottom.
 * The header above and the tab bar below are native and inset the content themselves, so a
 * screen never measures the status bar or the tab bar by hand.
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: SPACE.lg, paddingBottom: SPACE.xxl, gap: SPACE.lg }}
    >
      {children}
    </ScrollView>
  );
}
