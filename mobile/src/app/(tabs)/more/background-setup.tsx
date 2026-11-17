import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Text } from '@/components/text';
import { thisPhoneIsXiaomi } from '@/lib/notifications/background-setup';
import { describeSync } from '@/lib/notifications/sync-status';
import { loadLastSync } from '@/lib/notifications/tray-store';
import { SPACE } from '@/theme/scale';

/**
 * The background setup: the two switches HyperOS needs before it lets the hourly sync run, and
 * the one thing not to do. Offered once after sign-in on a Xiaomi phone (or any phone where
 * Android reports background work restricted), and always reachable from Settings →
 * Notifications. docs/features/platform.md § Android app, "Xiaomi's battery saver".
 *
 * - **Both switches live on the app's page in Android's settings**, so one button opens it; no
 *   app can turn them on, or even read Autostart, so the screen explains rather than checks.
 * - **The proof is "Last synced"**, at the foot: within the hour or two once both are on.
 * - The two settings are side by side, not numbered: they are independent, in any order.
 */
export default function BackgroundSetup() {
  // The sync's last run in words, worked out when read: it depends on the time.
  const [syncText, setSyncText] = useState<string | null>(null);
  const xiaomi = thisPhoneIsXiaomi();

  useFocusEffect(
    useCallback(() => {
      void loadLastSync().then((lastSync) => setSyncText(describeSync(lastSync, new Date()).text));
    }, [])
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Background setup' }} />
      <Screen>
        <Text>
          {xiaomi
            ? 'HyperOS stops apps working in the background unless they are allowed to. Without these two settings, notifications reach this phone only when you open the app.'
            : 'Some phones stop apps working in the background. If notifications reach this phone only when you open the app, turn these two settings on.'}
        </Text>

        <Section
          title="Two settings"
          description="Both are on the app’s page in Android’s settings."
        >
          <Card style={{ padding: SPACE.xl, gap: SPACE.lg }}>
            <Setting
              icon="power_settings_new"
              title="Autostart: on"
              body="Lets the app start itself to sync, and to set its reminders again after a restart."
            />
            <Setting
              icon="battery_saver"
              title="Battery saver: No restrictions"
              body="Stops the phone pausing the hourly sync to save battery."
            />
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
            <Setting
              icon="block"
              title="Don’t force-stop the app"
              body="Android then cancels its reminders until you open the app again. Clearing recent apps can count as a force stop on this phone."
            />
          </Card>
        </Section>

        <Section title="Is it working?">
          <Card style={{ padding: SPACE.xl, gap: SPACE.xs }}>
            <Text>{syncText ?? 'Checking…'}</Text>
            <Text tone="fgMuted">
              With both settings on, this stays within the last hour or two.
            </Text>
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
