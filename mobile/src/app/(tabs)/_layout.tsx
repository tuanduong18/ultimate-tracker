import { NativeTabs } from 'expo-router/native-tabs';

import { TABBED } from '@/navigation/modules';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The bottom navigation: the first four modules and More, as on the web's phone layout.
 *
 * Native tabs, so this is Android's own Material navigation bar — its ripple, its TalkBack
 * semantics, its handling of the gesture bar — not a lookalike. Mapped to the theme the way the
 * web's bar is: the bar on `surface`, the current tab's icon in a `primary-soft` pill (which is
 * exactly Material's active indicator) with icon and label in `primary`, the rest in
 * `fg-muted`. Labels always show; an icon alone is a guessing game.
 *
 * More is a tab of its own, not a drawer: a drawer over the tabs fights the system back
 * gesture, while a screen behaves the way Android users expect — and its pushed screens keep
 * the tab bar.
 */
export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}
      iconColor={{ default: colors.fgMuted, selected: colors.primary }}
      labelStyle={{ default: { color: colors.fgMuted }, selected: { color: colors.primary } }}
      labelVisibilityMode="labeled"
    >
      {TABBED.map((entry) => (
        <NativeTabs.Trigger key={entry.key} name={entry.key}>
          <NativeTabs.Trigger.Label>{entry.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md={entry.icon} />
        </NativeTabs.Trigger>
      ))}
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
