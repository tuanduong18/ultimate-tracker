import { NotificationList } from '@/components/notifications/notification-list';
import { PageHeader } from '@/components/shared/page-header';

export default function NotificationsPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <PageHeader
        title="Notifications"
        description="Reminders count down to each charge; renewals and notices stay in the history until you delete them."
      />

      <NotificationList />
    </main>
  );
}
