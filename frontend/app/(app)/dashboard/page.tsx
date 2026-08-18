'use client';

import { useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/hooks/use-session';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  timezone: string;
  created_at: string;
}

export default function DashboardPage() {
  // AuthGuard only renders this page once there is a session, so the fetch below
  // never races an unauthenticated first paint.
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState('Loading your profile…');

  useEffect(() => {
    api
      .get<Profile>('/auth/me')
      .then((p) => {
        setProfile(p);
        setStatus('');
      })
      .catch((err: unknown) => {
        setStatus(
          err instanceof ApiError
            ? `Backend error — ${err.code}: ${err.message}`
            : `Request failed: ${String(err)}`
        );
      });
  }, []);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="mt-6 space-y-3">
        {session && (
          <p className="text-sm">
            Signed in as <span className="font-mono">{session.user.email}</span>
          </p>
        )}

        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => void supabase.auth.signOut()}
        >
          Log out
        </button>

        {profile && (
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">
            {JSON.stringify(profile, null, 2)}
          </pre>
        )}
      </div>

      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}
    </main>
  );
}
