'use client';

import { AuthGuard } from '@/components/shared/auth-guard';

/**
 * Layout for every route that needs a signed-in user. Grouping them under
 * `(app)` keeps the guard in one place — a new domain page is protected by
 * where it lives, not by remembering to add a check.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
