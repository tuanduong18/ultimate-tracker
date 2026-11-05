import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Wordmark } from '@/components/brand';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { MORE } from '@/navigation/modules';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Everything that has no tab: the modules after the first four, and — as they arrive — the
 * account (profile, settings, sign out), which on the web lives in the header's account menu.
 * Rows in one card, divided by hairlines, so the list reads as one group.
 *
 * The app's name and version sit at the foot: with a sideloaded app, "which version do you
 * have?" is the first question when something looks wrong.
 */
export default function More() {
  const { colors } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'More' }} />
      <Screen>
        <View style={{ gap: SPACE.sm }}>
          <Text variant="caption" tone="fgMuted" accessibilityRole="header">
            More modules
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: RADIUS.card,
              overflow: 'hidden',
            }}
          >
            {MORE.map((entry, index) => (
              <View
                key={entry.key}
                style={index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }}
              >
                <NavRow
                  href={`/more/${entry.key}`}
                  label={entry.label}
                  blurb={entry.blurb}
                  icon={entry.icon}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.lg }}>
          <Wordmark />
          <Text variant="caption" tone="fgMuted">
            Version {Constants.expoConfig?.version ?? 'unknown'}
          </Text>
        </View>
      </Screen>
    </>
  );
}
