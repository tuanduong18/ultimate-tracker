import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useSession } from '@/auth/session';
import { ActionRow } from '@/components/action-row';
import { Wordmark } from '@/components/brand';
import { Card, RowDivider } from '@/components/card';
import { IconBadge } from '@/components/icon';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { supabase } from '@/lib/supabase';
import { MORE } from '@/navigation/modules';
import { SPACE } from '@/theme/scale';

/**
 * Everything that has no tab: the modules after the first four, then the account — which on
 * the web lives in the header's account menu. Each group is one card of rows divided by
 * hairlines, under a small header TalkBack can jump to.
 *
 * Log out needs no confirmation, as on the web: nothing is lost — everything lives on the
 * server and comes back at the next log-in. (That changes once the app keeps unsent changes
 * offline; then logging out would throw them away, and it must say so.)
 *
 * The app's name and version sit at the foot: with a sideloaded app, "which version do you
 * have?" is the first question when something looks wrong.
 */
export default function More() {
  return (
    <>
      <Stack.Screen options={{ title: 'More' }} />
      <Screen>
        <Section title="More modules">
          <Card>
            {MORE.map((entry, index) => (
              <View key={entry.key}>
                {index > 0 && <RowDivider />}
                <NavRow
                  href={`/more/${entry.key}`}
                  label={entry.label}
                  blurb={entry.blurb}
                  icon={entry.icon}
                />
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Account">
          <AccountCard />
        </Section>

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text variant="caption" tone="fgMuted" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Who is signed in, how, and the way out. */
function AccountCard() {
  const { session } = useSession();
  const [leaving, setLeaving] = useState(false);
  const user = session?.user;
  const provider = user?.app_metadata.provider === 'google' ? 'Google' : 'email';

  async function logOut() {
    setLeaving(true);
    // The session clears, and the root layout's guard takes over from here.
    const { error } = await supabase.auth.signOut();
    if (error) setLeaving(false);
  }

  return (
    <Card>
      <View
        accessible
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.md,
        }}
      >
        <IconBadge name="account_circle" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {user?.email ?? 'Signed in'}
          </Text>
          <Text variant="caption" tone="fgMuted">
            Signed in with {provider}
          </Text>
        </View>
      </View>
      <RowDivider />
      <ActionRow
        label={leaving ? 'Logging out…' : 'Log out'}
        icon="logout"
        disabled={leaving}
        onPress={() => void logOut()}
      />
    </Card>
  );
}
