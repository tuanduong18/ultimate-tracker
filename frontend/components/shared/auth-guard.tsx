'use client';

import { useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { useSession } from '@/lib/hooks/use-session';

/**
 * Gate for every signed-in route.
 *
 * The API is the real security boundary — it verifies the Supabase JWT on every
 * request. This guard exists so a signed-out visitor lands on the login page
 * instead of an app shell that renders empty state and failed requests, and so
 * they come back to the page they asked for.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, session, pathname, router]);

  if (loading || !session) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">{loading ? 'Loading…' : 'Redirecting to sign in…'}</p>
      </main>
    );
  }

  return <>{children}</>;
}
