import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { displayNameOf } from '@/auth/identity';
import { useSession } from '@/auth/session';
import { ActionRow } from '@/components/action-row';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/button';
import { Card, RowDivider } from '@/components/card';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Text } from '@/components/text';
import { formatDate, toIsoDate } from '@/lib/dates';
import { useProfile } from '@/lib/finance/queries';
import { supabase } from '@/lib/supabase';
import { useNewerRelease } from '@/lib/release-check';
import { MORE } from '@/navigation/modules';
import { SPACE } from '@/theme/scale';

/**
 * Everything that has no tab: the modules after the first four, then the account — which on
 * the web lives in the header's account menu. Each group is one card of rows divided by
 * hairlines, under a small header TalkBack can jump to.
 *
 * Log out needs no confirmation, as on the web: nothing is lost — everything lives on the
 * server and comes back at the next log-in. The app keeps nothing unsent on the phone
 * (it is online-only, ADR-0006).
 *
 * The app's name and version sit at the foot: with a sideloaded app, "which version do you
 * have?" is the first question when something looks wrong. After an over-the-air update the
 * version alone no longer answers it, so the running update's date sits beside it. When a newer
 * APK is on GitHub Releases, a link to it sits underneath (lib/release-check.ts).
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

        {/* Never in the build users install. */}
        {__DEV__ && (
          <Section title="Development">
            <Card>
              <NavRow
                href="/more/testing"
                label="Testing tools"
                blurb="The tray's moments, brought forward"
                icon="science"
              />
            </Card>
          </Section>
        )}

        <VersionFoot />
      </Screen>
    </>
  );
}

/**
 * Who is signed in, the settings for this phone, and the way out — in that order, so Log out
 * sits last, away from the row people tap most. The first row is the person — their name, or
 * their email until they have one — and opens the Profile, where the name, the sign-in methods
 * and the currencies are; on the web all three rows live in the account menu.
 */
function AccountCard() {
  const { session } = useSession();
  const profile = useProfile();
  const [leaving, setLeaving] = useState(false);
  const user = session?.user;
  const name = displayNameOf(profile.data, user);

  async function logOut() {
    setLeaving(true);
    // The session clears, and the root layout's guard takes over from here.
    const { error } = await supabase.auth.signOut();
    if (error) setLeaving(false);
  }

  return (
    <Card>
      <NavRow
        href="/more/profile"
        label={name ?? user?.email ?? 'Profile'}
        blurb={name ? (user?.email ?? 'Profile') : 'Profile, sign-in and currencies'}
        icon="account_circle"
      />
      <RowDivider />
      <NavRow
        href="/more/settings"
        label="Settings"
        blurb="Notifications, and how the app looks"
        icon="settings"
      />
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

/**
 * The wordmark and the version — with the running update's date after an over-the-air update,
 * since the version alone then no longer says what is running — and, when GitHub Releases has a
 * newer APK, a link to it. Nothing about updates shows in the development build, where updates
 * are off.
 */
function VersionFoot() {
  const newer = useNewerRelease();
  const updated =
    !Updates.isEmbeddedLaunch && Updates.createdAt
      ? formatDate(toIsoDate(Updates.createdAt))
      : null;
  return (
    <View style={{ alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.lg }}>
      <Wordmark />
      <Text variant="caption" tone="fgMuted">
        Version {Constants.expoConfig?.version ?? 'unknown'}
        {updated ? ` · update of ${updated}` : ''}
      </Text>
      {newer && (
        <Button
          variant="text"
          label={`Version ${newer.version} is available`}
          icon="download"
          onPress={() => void Linking.openURL(newer.url)}
        />
      )}
    </View>
  );
}
