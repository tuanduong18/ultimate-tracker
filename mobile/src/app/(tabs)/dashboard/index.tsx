import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { displayNameOf, firstNameOf } from '@/auth/identity';
import { useSession } from '@/auth/session';
import { Button } from '@/components/button';
import { Card, RowDivider } from '@/components/card';
import { SummaryTiles } from '@/components/finance/summary-tiles';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Text } from '@/components/text';
import { financeKeys, profileKey, useProfile } from '@/lib/finance/queries';
import { MODULES } from '@/navigation/modules';
import { SPACE } from '@/theme/scale';

/**
 * The Dashboard — the app's first screen, twin of the web's: a greeting, this month's money at
 * a glance, then every module with an honest word on what is ready.
 *
 * The money is Finance's own two tiles (spent so far against last month, and the next charge),
 * the same component Finance's Overview opens with, so the two can never disagree. Unbuilt
 * modules stay openable — their screens say what is coming — but wear a "Coming in …" tag, so
 * nobody taps expecting a tracker and finds a promise. Pulling down reloads the figures.
 *
 * Its links navigate (switch to the module's tab) rather than `dismissTo`: from inside the tabs,
 * a dismissTo is aimed at the tab navigator, which has no stack to pop and drops it.
 */
export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const profile = useProfile();
  const name = displayNameOf(profile.data, session?.user);
  const modules = MODULES.filter((entry) => entry.key !== 'dashboard');

  return (
    <>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <Screen
        onRefresh={() =>
          Promise.all([
            queryClient.refetchQueries({ queryKey: financeKeys.all, type: 'active' }),
            queryClient.refetchQueries({ queryKey: profileKey, type: 'active' }),
          ])
        }
      >
        <View style={{ gap: SPACE.xs }}>
          <Text variant="label" tone="primary">
            {name ? `Welcome back, ${firstNameOf(name)}` : 'Welcome back'}
          </Text>
          <Text variant="title" accessibilityRole="header">
            Your life, at a glance
          </Text>
          <Text tone="fgMuted">
            Money is tracked today. Fitness, time and insights are on their way — each will show up
            here as it lands.
          </Text>
        </View>

        <Section title="Money this month">
          <SummaryTiles />
          <Button
            label="See all finance"
            variant="text"
            accessibilityRole="link"
            onPress={() => router.navigate('/finance')}
          />
        </Section>

        <Section title="Modules">
          <Card>
            {modules.map((entry, index) => (
              <View key={entry.key}>
                {index > 0 && <RowDivider />}
                <NavRow
                  href={entry.href}
                  label={entry.label}
                  blurb={entry.blurb}
                  icon={entry.icon}
                  tag={entry.status === 'soon' ? `Coming in ${entry.release}` : undefined}
                />
              </View>
            ))}
          </Card>
        </Section>
      </Screen>
    </>
  );
}
