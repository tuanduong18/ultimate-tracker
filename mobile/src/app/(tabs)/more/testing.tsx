import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/auth/session';
import { ActionRow } from '@/components/action-row';
import { Card, RowDivider } from '@/components/card';
import { FormError } from '@/components/form-error';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Text } from '@/components/text';
import { clearTray, syncTray } from '@/lib/notifications/sync';
import { describeSync } from '@/lib/notifications/sync-status';
import { REMINDER_TIME } from '@/lib/notifications/tray-plan';
import {
  loadLastSync,
  loadTestReminderTime,
  saveMarks,
  saveTestReminderTime,
} from '@/lib/notifications/tray-store';
import { SPACE } from '@/theme/scale';

interface Snapshot {
  scheduled: string[];
  tray: string[];
  reminderTime: { hour: number; minute: number } | null;
  lastSync: string;
}

/**
 * Testing tools, in the development build only (More → Development): the tray's moments brought
 * forward, so trying a scenario takes minutes rather than a day.
 *
 * - **Sync as the background run does**: the app open, but new rows go to the tray.
 * - **Run the background task**: Android starts it now, proving the task itself works.
 * - **Reminders in two minutes**: today's countdown rings two minutes from now instead of 09:00.
 * - **Show everything again**: forget what was shown, so the next sync shows every unread row.
 * - What Android holds — scheduled ids with their times, tray entries — so a step's effect shows
 *   at once.
 */
export default function Testing() {
  const { session } = useSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [scheduled, presented, reminderTime, lastSync] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
      loadTestReminderTime(),
      loadLastSync(),
    ]);
    setSnapshot({
      scheduled: scheduled.map((request) => `${request.identifier} · ${firesAt(request.trigger)}`),
      tray: presented.map(
        ({ request }) => `${request.identifier} · ${request.content.title ?? ''}`
      ),
      reminderTime,
      lastSync: describeSync(lastSync, new Date()).text,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const act = async (work: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
    await load();
  };

  const setReminderTime = async (time: { hour: number; minute: number } | null) => {
    await saveTestReminderTime(time);
    await syncTray({ appOpen: false });
  };

  const time = snapshot?.reminderTime ?? REMINDER_TIME;

  return (
    <>
      <Stack.Screen options={{ title: 'Testing tools' }} />
      <Screen onRefresh={load}>
        {problem !== null && <FormError message={problem} />}

        <Section
          title="Tray sync"
          description={`${snapshot?.lastSync ?? 'Checking…'} Reminders ring at ${clock(time.hour, time.minute)}.`}
        >
          <Card>
            <ActionRow
              label="Sync as the background run does"
              blurb="New rows go to the tray even with the app open"
              icon="sync"
              onPress={() => void act(() => syncTray({ appOpen: false }))}
            />
            <RowDivider />
            <ActionRow
              label="Run the background task now"
              blurb="Android starts it; proves the task, not its timing"
              icon="play_arrow"
              onPress={() =>
                void act(async () => {
                  await BackgroundTask.triggerTaskWorkerForTestingAsync();
                  await new Promise((resolve) => setTimeout(resolve, 3000));
                })
              }
            />
            <RowDivider />
            <ActionRow
              label="Reminders in two minutes"
              blurb="Today’s countdown rings then instead of 09:00"
              icon="alarm_add"
              onPress={() =>
                void act(() => {
                  const at = new Date(Date.now() + 2 * 60_000);
                  return setReminderTime({ hour: at.getHours(), minute: at.getMinutes() });
                })
              }
            />
            <RowDivider />
            <ActionRow
              label="Reminders back at 09:00"
              icon="alarm"
              onPress={() => void act(() => setReminderTime(null))}
            />
            <RowDivider />
            <ActionRow
              label="Show everything again"
              blurb="Forget what was shown, then sync as the background run"
              icon="replay"
              disabled={!session}
              onPress={() =>
                void act(async () => {
                  if (!session) return;
                  await saveMarks(session.user.id, { newestNotice: null, reminderDays: {} });
                  await syncTray({ appOpen: false });
                })
              }
            />
            <RowDivider />
            <ActionRow
              label="Clear the tray"
              blurb="As logging out does"
              icon="notifications_off"
              onPress={() => void act(clearTray)}
            />
          </Card>
        </Section>

        <Listing title="Scheduled" rows={snapshot?.scheduled} empty="Nothing scheduled." />
        <Listing title="In the tray" rows={snapshot?.tray} empty="Nothing in the tray." />
      </Screen>
    </>
  );
}

function Listing({ title, rows, empty }: { title: string; rows?: string[]; empty: string }) {
  return (
    <Section title={title}>
      <Card style={{ padding: SPACE.xl, gap: SPACE.sm }}>
        {rows === undefined ? (
          <Text tone="fgMuted">Checking…</Text>
        ) : rows.length === 0 ? (
          <Text tone="fgMuted">{empty}</Text>
        ) : (
          rows.map((row) => (
            <Text key={row} variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
              {row}
            </Text>
          ))
        )}
      </Card>
    </Section>
  );
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function firesAt(trigger: Notifications.NotificationTrigger | null): string {
  const value = (trigger as { value?: number } | null)?.value;
  if (typeof value !== 'number') return 'when Android decides';
  const at = new Date(value);
  return `${at.getDate()}/${at.getMonth() + 1} ${clock(at.getHours(), at.getMinutes())}`;
}
