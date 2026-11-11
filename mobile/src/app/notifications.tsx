import type { UseQueryResult } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import type { IconName } from '@/components/icon';
import { NotificationRow } from '@/components/notifications/notification-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { loadError } from '@/lib/finance/queries';
import type { AppNotification } from '@/lib/notifications/notifications';
import { useHistory, useInbox, useMarkRead } from '@/lib/notifications/queries';

/**
 * Notifications — the twin of the web's /notifications page and its bell panel in one: the
 * inbox (what the bell counts), then the history (snoozed reminders and notices moved there).
 * Opened from the bell on any tab, above the tabs, with a back arrow.
 *
 * Opening it marks the inbox read, as opening the web's panel does, so the badge clears. What was
 * unread keeps its dot while the screen stays open, so it still shows what is new — and anything
 * that arrives while it is open (Realtime keeps both lists live) is marked and dotted the same
 * way. Read is not done: a reminder stays until its charge or until it is snoozed, a notice
 * until it is moved to the history.
 */
export default function Notifications() {
  const inbox = useInbox();
  const history = useHistory();
  const markRead = useMarkRead();
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  // Ids already sent as read, so a reload that still shows them unread doesn't send them again.
  const sent = useRef(new Set<string>());

  useEffect(() => {
    const unread = (inbox.data ?? [])
      .filter((n) => n.read_at === null && !sent.current.has(n.id))
      .map((n) => n.id);
    if (unread.length === 0) return;
    for (const id of unread) sent.current.add(id);
    setFresh((current) => new Set([...current, ...unread]));
    void markRead(unread);
  }, [inbox.data, markRead]);

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Screen onRefresh={() => Promise.all([inbox.refetch(), history.refetch()])}>
        <List
          title="Inbox"
          query={inbox}
          fresh={fresh}
          empty={{ icon: 'done_all', message: 'Nothing needs you right now.' }}
        />
        <List
          title="History"
          query={history}
          empty={{
            icon: 'history',
            message: 'Snoozed reminders and past renewals will show up here.',
          }}
        />
      </Screen>
    </>
  );
}

/** One of the two lists, in its four states, its count beside the title as on the web. */
function List({
  title,
  query,
  fresh,
  empty,
}: {
  title: string;
  query: UseQueryResult<AppNotification[]>;
  fresh?: ReadonlySet<string>;
  empty: { icon: IconName; message: string };
}) {
  const items = query.data ?? [];
  return (
    <Section title={items.length > 0 ? `${title} · ${items.length}` : title}>
      {query.isPending ? (
        <LoadingState rows={2} />
      ) : query.error && !query.data ? (
        <ErrorState
          message={loadError(query, 'Could not load your notifications.') ?? ''}
          onRetry={() => query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={empty.icon} message={empty.message} />
      ) : (
        <Card>
          {items.map((notification, index) => (
            <View key={notification.id}>
              {index > 0 && <RowDivider />}
              <NotificationRow
                notification={notification}
                fresh={fresh?.has(notification.id) ?? false}
              />
            </View>
          ))}
        </Card>
      )}
    </Section>
  );
}
