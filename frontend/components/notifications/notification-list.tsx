'use client';

import { NotificationItem } from '@/components/notifications/notification-item';
import { useCollection, type Collection } from '@/lib/hooks/use-collection';
import { useNotificationUpdates } from '@/lib/hooks/use-notification-updates';
import type { AppNotification } from '@/lib/types/notification';

function Section({
  title,
  empty,
  list,
  markFresh,
}: {
  title: string;
  empty: string;
  list: Collection<AppNotification>;
  markFresh: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          {title}
          {list.items.length > 0 && (
            <span className="ml-1.5 font-normal text-fg-muted">{list.items.length}</span>
          )}
        </h2>
      </header>
      {list.error && (
        <p role="alert" className="px-4 py-3 text-sm text-negative">
          {list.error}
        </p>
      )}
      {!list.error && list.items.length === 0 && (
        <p className="px-4 py-6 text-sm text-fg-muted">{list.loading ? 'Loading…' : empty}</p>
      )}
      <div className="divide-y divide-border">
        {list.items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            fresh={markFresh && notification.read_at === null}
            onChanged={list.reload}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The inbox — what the bell shows — and the history: snoozed reminders, which
 * can be unsnoozed, and notices moved there, which can be deleted.
 */
export function NotificationList() {
  const inbox = useCollection<AppNotification>('/notifications?view=inbox&limit=100');
  const history = useCollection<AppNotification>('/notifications?view=history&limit=100');
  const { reload: reloadInbox } = inbox;
  const { reload: reloadHistory } = history;

  useNotificationUpdates(() => {
    void reloadInbox();
    void reloadHistory();
  });

  return (
    <div className="mt-6 space-y-6">
      <Section title="Inbox" empty="Nothing needs you right now." list={inbox} markFresh />
      <Section
        title="History"
        empty="Snoozed reminders and past renewals will show up here."
        list={history}
        markFresh={false}
      />
    </div>
  );
}
