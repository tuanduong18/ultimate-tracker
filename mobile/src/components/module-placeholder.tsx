import { Linking, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { Card } from '@/components/card';
import { IconBadge } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { WEB_APP_URL } from '@/config';
import type { ModuleEntry } from '@/navigation/modules';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The screen for a module the app does not have yet — the phone's version of the web's
 * ComingSoon.
 *
 * Two honest states. A module built on the web says so and opens it there, so the tab ends
 * somewhere useful today rather than at a blank screen. A module built nowhere yet says when it
 * lands and what it will do, from the release plan. Neither shows a mock-up of data nobody has.
 */
export function ModulePlaceholder({ module: entry }: { module: ModuleEntry }) {
  const { colors } = useAppTheme();
  const onWeb = entry.status === 'web';

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
              {onWeb ? 'On the web now' : `Coming in ${entry.release}`}
            </Text>
          </View>
          <Text variant="heading" accessibilityRole="header">
            {onWeb ? `${entry.label} is coming to the app` : `${entry.label} is on its way`}
          </Text>
          <Text tone="fgMuted">
            {onWeb
              ? 'It works on the web today, and it is next in line for the app.'
              : 'Here is what it will do.'}
          </Text>
        </View>

        {entry.status === 'soon' && (
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
        )}

        {entry.status === 'web' && (
          <PrimaryButton
            label={`Open ${entry.label} on the web`}
            icon="open_in_new"
            accessibilityRole="link"
            accessibilityHint="Opens in your browser"
            onPress={() => Linking.openURL(`${WEB_APP_URL}${entry.webPath}`)}
          />
        )}
      </Card>
    </Screen>
  );
}
