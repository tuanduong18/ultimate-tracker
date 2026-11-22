import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Text } from '@/components/text';
import { setupGuide, thisPhoneIsXiaomi } from '@/lib/notifications/background-setup';
import { describeSync } from '@/lib/notifications/sync-status';
import { loadLastSync } from '@/lib/notifications/tray-store';
import { SPACE } from '@/theme/scale';

/**
 * The background setup: what this phone needs before it lets the hourly sync run, and the one
 * thing not to do. Offered once after sign-in on a Xiaomi phone (or any phone where Android
 * reports background work restricted), and listed in Settings → Notifications when it applies.
 * docs/features/platform.md § Android app, "Xiaomi's battery saver".
 *
 * - **The steps follow the phone** (`setupGuide`): HyperOS's two switches on a Xiaomi, Android's
 *   one battery setting elsewhere — never a switch the phone hasn't got.
 * - **Every setting lives on the app's page in Android's settings**, so one button opens it; no
 *   app can turn them on, or even read Autostart, so the screen explains rather than checks.
 * - **The proof is "Last synced"**, at the foot: within the hour or two once both are on.
 * - Settings are side by side, not numbered: they are independent, in any order.
 */
export default function BackgroundSetup() {
  // The sync's last run in words, worked out when read: it depends on the time.
  const [syncText, setSyncText] = useState<string | null>(null);
  const guide = setupGuide(thisPhoneIsXiaomi());
  const several = guide.steps.length > 1;

  useFocusEffect(
    useCallback(() => {
      void loadLastSync().then((lastSync) => setSyncText(describeSync(lastSync, new Date()).text));
    }, [])
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Background setup' }} />
      <Screen>
        <Text>{guide.intro}</Text>

        <Section
          title={several ? 'Two settings' : 'One setting'}
          description={
            several
              ? 'Both are on the app’s page in Android’s settings.'
              : 'It is on the app’s page in Android’s settings.'
          }
        >
          <Card style={{ padding: SPACE.xl, gap: SPACE.lg }}>
            {guide.steps.map((step) => (
              <Setting key={step.title} icon={step.icon} title={step.title} body={step.body} />
            ))}
          </Card>
          <PrimaryButton
            label="Open the app’s settings"
            icon="open_in_new"
            fullWidth
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section title="One thing to avoid">
          <Card style={{ padding: SPACE.xl }}>
            <Setting icon="block" title="Don’t force-stop the app" body={guide.avoid} />
          </Card>
        </Section>

        <Section title="Is it working?">
          <Card style={{ padding: SPACE.xl, gap: SPACE.xs }}>
            <Text>{syncText ?? 'Checking…'}</Text>
            <Text tone="fgMuted">Once set, this stays within the last hour or two.</Text>
          </Card>
        </Section>
      </Screen>
    </>
  );
}

/** One setting: its icon, what to set it to, and why. Decorative icon; the words carry it. */
function Setting({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.md }}>
      <Icon name={icon} tone="primary" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text tone="fgMuted">{body}</Text>
      </View>
    </View>
  );
}
