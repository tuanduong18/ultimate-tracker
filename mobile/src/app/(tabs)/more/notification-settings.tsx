import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { ActionRow } from '@/components/action-row';
import { Card, RowDivider } from '@/components/card';
import { FormError } from '@/components/form-error';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/states';
import { SwitchRow } from '@/components/switch-row';
import { Text } from '@/components/text';
import { describeError } from '@/lib/describe-error';
import { useProfile } from '@/lib/finance/queries';
import {
  needsBackgroundSetup,
  openAppNotificationSettings,
  openChannelSettings,
} from '@/lib/notifications/background-setup';
import { CATEGORIES, isMutable, type MutableCategory } from '@/lib/notifications/categories';
import { channelsOn } from '@/lib/notifications/channels';
import { useMutedWrite } from '@/lib/notifications/preferences';
import { describeSync, type SyncStatus } from '@/lib/notifications/sync-status';
import { loadLastSync } from '@/lib/notifications/tray-store';
import { SPACE } from '@/theme/scale';

const APP_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.tuanduong.ultimatetracker';

interface PhoneState {
  allowed: boolean;
  channels: Record<string, boolean>;
  /** Worked out when read, not at render: it depends on the time. */
  sync: SyncStatus;
  synced: boolean;
  needsSetup: boolean;
}

/**
 * Settings → Notifications: the account's switches, then what reaches this phone and whether the
 * sync that brings it is running. docs/features/platform.md § Notification preferences, "On the
 * phone".
 *
 * - **On every device first** (`AccountSwitches`): the web's three switches in the web's words.
 *   They hold everywhere, so they sit apart from, and above, what is this phone's alone.
 * - **On this phone is Android's, shown as Android has it.** The app keeps no tray switch of its
 *   own: Android's is the one switch, so the two can never disagree. Each row opens its page in
 *   Android's settings, and the screen reads them again on coming back.
 * - **The sync's last run, in words** — the only way to see whether a battery saver is stopping
 *   it, since no app can read Autostart — with the background setup one row away.
 */
export default function NotificationSettings() {
  const [state, setState] = useState<PhoneState | null>(null);

  const load = useCallback(async () => {
    const [permission, channels, lastSync, needsSetup] = await Promise.all([
      Notifications.getPermissionsAsync(),
      channelsOn(),
      loadLastSync(),
      needsBackgroundSetup(),
    ]);
    setState({
      allowed: permission.status === Notifications.PermissionStatus.GRANTED,
      channels,
      sync: describeSync(lastSync, new Date()),
      synced: lastSync !== null,
      needsSetup,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useEffect(() => {
    // Back from Android's settings, where the person may just have changed something.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const sync = state?.sync ?? null;

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Screen onRefresh={load}>
        <AccountSwitches />

        <Section
          title="On this phone"
          description="Android decides what reaches this phone. Turning a kind off there stops it here only; the bell still shows it."
        >
          <Card>
            <ActionRow
              label="Notifications"
              blurb={
                state === null ? 'Checking…' : state.allowed ? 'Allowed' : 'Off in Android settings'
              }
              icon={state?.allowed === false ? 'notifications_off' : 'notifications'}
              onPress={() => void openAppNotificationSettings(APP_PACKAGE)}
            />
            {CATEGORIES.map((category) => (
              <View key={category.id}>
                <RowDivider />
                <ActionRow
                  label={category.label}
                  blurb={channelBlurb(state, category.id)}
                  icon={category.icon}
                  onPress={() => void openChannelSettings(APP_PACKAGE, category.id)}
                />
              </View>
            ))}
          </Card>
        </Section>

        <Section
          title="Background sync"
          description="About once an hour, notifications are brought to this phone even with the app closed."
        >
          <Card style={{ padding: SPACE.xl, gap: SPACE.xs }}>
            <Text>{sync?.text ?? 'Checking…'}</Text>
            {sync?.behind && state?.synced && (
              <Text tone="fgMuted">
                That is longer than it should be. The background setup below usually fixes it.
              </Text>
            )}
          </Card>
          <Card>
            <NavRow
              href="/more/background-setup"
              label="Background setup"
              blurb={state?.needsSetup ? 'Two settings this phone needs' : 'If syncing stops'}
              icon="battery_saver"
            />
          </Card>
        </Section>
      </Screen>
    </>
  );
}

function channelBlurb(state: PhoneState | null, id: string): string {
  if (state === null) return 'Checking…';
  if (!state.allowed) return 'Off with the app’s notifications';
  return state.channels[id] === false ? 'Off in Android settings' : 'On';
}

/**
 * The account's switches: one per category that can be turned off, the same three as the web's
 * Settings, in the same words. Off means never written — not in the bell, not in the tray, on
 * any device.
 *
 * A switch applies the moment it is flipped, as the look does: it shows its new position while
 * the save runs and flips back, with the reason underneath, if the save fails — at once when
 * there is no connection, rather than waiting as the app's other saves do (preferences.ts). One
 * save at a time, since each sends the whole list. Currency notices get a line, not a disabled
 * switch: a control that can't be used reads as broken.
 */
function AccountSwitches() {
  const profile = useProfile();
  const write = useMutedWrite();
  const [problem, setProblem] = useState<string | null>(null);

  const muted = profile.data?.muted_notifications ?? [];
  const shown = write.isPending && write.variables ? write.variables : muted;

  const flip = (id: MutableCategory, label: string, on: boolean) => {
    setProblem(null);
    write.mutate(on ? muted.filter((other) => other !== id) : [...muted, id], {
      onError: (error) =>
        setProblem(
          `${describeError(error, 'Couldn’t save that.')} ${label} is still ${on ? 'off' : 'on'}.`
        ),
    });
  };

  return (
    <Section
      title="On every device"
      description="Turn one off and it stops everywhere: the bell, the web and this phone. Currency notices always arrive."
    >
      {profile.isPending ? (
        <LoadingState rows={3} />
      ) : profile.isError ? (
        <ErrorState
          message="Couldn’t load your notification settings."
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <>
          <Card>
            {CATEGORIES.filter(isMutable).map((category, index) => (
              <View key={category.id}>
                {index > 0 && <RowDivider />}
                <SwitchRow
                  label={category.label}
                  description={category.description}
                  value={!shown.includes(category.id)}
                  disabled={write.isPending}
                  onChange={(on) => flip(category.id, category.label, on)}
                />
              </View>
            ))}
          </Card>
          {problem !== null && <FormError message={problem} />}
        </>
      )}
    </Section>
  );
}
