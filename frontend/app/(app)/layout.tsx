'use client';

import { AppNav } from '@/components/shared/app-nav';
import { AuthGuard } from '@/components/shared/auth-guard';

/**
 * Layout for every route that needs a signed-in user. Grouping them under
 * `(app)` keeps the guard in one place — a new domain page is protected by
 * where it lives, not by remembering to add a check — and gives every module
 * the same navigation without each page rendering its own.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppNav />
        <div className="flex-1">{children}</div>
      </div>
    </AuthGuard>
  );
}
