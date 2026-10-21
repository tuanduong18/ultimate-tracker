'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { Wordmark } from '@/components/shared/brand';
import { NavDrawer } from '@/components/shared/nav-drawer';
import { UserMenu } from '@/components/shared/user-menu';

/**
 * The bar across the top of every signed-in page, at every width.
 *
 * On a phone it carries the menu button and the app name, since there is no
 * sidebar to hold them. From md up the sidebar has both, and the bar keeps
 * only the notification bell and the account menu — top right, where people
 * look for them.
 *
 * Sticky, so navigation is one tap away however far down a long page goes.
 */
export function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/90 px-2 backdrop-blur-sm sm:px-4">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        aria-controls="nav-drawer"
        className="flex size-11 items-center justify-center rounded-lg hover:bg-primary-soft md:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </button>

      <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center rounded-lg md:hidden">
        <Wordmark nameClassName="truncate" />
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
