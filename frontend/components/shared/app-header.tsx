'use client';

import Link from 'next/link';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { Wordmark } from '@/components/shared/brand';
import { LogMenu } from '@/components/shared/log-menu';
import { UserMenu } from '@/components/shared/user-menu';

/**
 * The bar across the top of every signed-in page, at every width.
 *
 * Holds only what belongs to every module: Log (anything, from anywhere — see
 * LogMenu), the notification bell and the account menu, top right, where
 * people look for them. A module's own actions live on its pages. On a phone
 * the bar also carries the app name, since there is no sidebar to hold it;
 * navigation itself lives in the bottom tab bar there, within thumb reach.
 *
 * Sticky, so these are one tap away however far down a long page goes.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/90 px-3 backdrop-blur-sm sm:px-4">
      <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center rounded-lg md:hidden">
        <Wordmark nameClassName="truncate" />
      </Link>

      <div className="ml-auto flex items-center gap-1.5">
        <LogMenu />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
