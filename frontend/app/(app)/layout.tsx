'use client';

import { AppHeader } from '@/components/shared/app-header';
import { AppSidebar } from '@/components/shared/app-nav';
import { BottomNav } from '@/components/shared/bottom-nav';
import { AuthGuard } from '@/components/shared/auth-guard';
import { TimezoneSync } from '@/components/shared/timezone-sync';

/**
 * Layout for every route that needs a signed-in user. Grouping them under
 * `(app)` keeps the guard in one place — a new domain page is protected by
 * where it lives, not by remembering to add a check — and gives every module
 * the same navigation without each page rendering its own.
 *
 * Navigation adapts to the width: a sidebar on desktops, a rail on tablets,
 * and a tab bar along the bottom on phones, with More opening a drawer for
 * the rest. Add expense, the bell and the account menu sit in the header, top
 * right, at every width.
 *
 * TimezoneSync sits inside the guard so it only runs for a signed-in user, and
 * here rather than on a page so it runs whichever page they land on.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TimezoneSync />
      <div className="flex min-h-dvh">
        <AppSidebar />
        {/* min-w-0 lets wide content scroll inside the page instead of
            stretching it past the screen. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {/* Room at the bottom on phones for the fixed tab bar (3.5rem tall,
              plus the home indicator's safe area), so it never covers content. */}
          <div className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
        </div>
      </div>
      <BottomNav />
    </AuthGuard>
  );
}
