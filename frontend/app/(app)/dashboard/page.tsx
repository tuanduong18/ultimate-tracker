'use client';

import Link from 'next/link';

import { MODULES } from '@/components/shared/app-nav';
import { useSession } from '@/lib/hooks/use-session';

export default function DashboardPage() {
  // AuthGuard only renders this once there is a session, so the email is safe
  // to read as soon as the hook resolves.
  const { session } = useSession();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-500">
        {session ? `Signed in as ${session.user.email}` : 'Loading…'}
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.filter((module) => module.href !== '/dashboard').map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              className="block rounded-lg border border-gray-200 p-4 hover:border-gray-400"
            >
              <span className="font-medium">{module.label}</span>
              <span className="mt-1 block text-sm text-gray-500">{module.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
