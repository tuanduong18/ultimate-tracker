import { View } from 'react-native';

import { Card } from '@/components/card';
import { IconBadge } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import type { PlaceholderEntry } from '@/navigation/modules';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The screen for a module that isn't built yet — the phone's version of the web's ComingSoon:
 * when it lands and what it will do, from the release plan, and never a mock-up of data nobody
 * has. (Until the Dashboard came to the app it had a second state, "On the web now" with a link
 * there; parity retired it, since a feature now ships on both clients or neither.)
 */
export function ModulePlaceholder({ module: entry }: { module: PlaceholderEntry }) {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <Card style={{ padding: SPACE.xl, gap: SPACE.lg }}>
        <IconBadge name={entry.icon} size="lg" />

        <View style={{ gap: SPACE.sm }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.primarySoft,
              borderRadius: RADIUS.pill,
              paddingHorizontal: SPACE.md,
              paddingVertical: SPACE.xs,
            }}
          >
            <Text variant="label" tone="primary">
              Coming in {entry.release}
            </Text>
          </View>
          <Text variant="heading" accessibilityRole="header">
            {entry.label} is on its way
          </Text>
          <Text tone="fgMuted">Here is what it will do.</Text>
        </View>

        <View style={{ gap: SPACE.md }}>
          {entry.planned.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: SPACE.md }}>
              <View
                style={{
                  marginTop: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
