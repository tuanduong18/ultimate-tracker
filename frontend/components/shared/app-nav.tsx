'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { supabase } from '@/lib/supabase';

/** Every signed-in destination, in the order the sidebar lists them. */
export const MODULES = [
  { href: '/dashboard', label: 'Dashboard', blurb: 'Everything at a glance' },
  { href: '/finance', label: 'Finance', blurb: 'Expenses, categories and budgets' },
  { href: '/steps', label: 'Steps', blurb: 'Daily step count and goal' },
  { href: '/fitness', label: 'Fitness', blurb: 'Workouts and personal records' },
  { href: '/time', label: 'Time', blurb: 'Where the hours go' },
  { href: '/wellness', label: 'Wellness', blurb: 'Sleep, mood and habits' },
  { href: '/insights', label: 'Insights', blurb: 'How the domains connect' },
] as const;

function isActive(pathname: string, href: string): boolean {
  // Prefix match so /finance/budgets keeps the Finance item highlighted.
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-gray-50 p-4">
      <Link href="/dashboard" className="px-3 text-lg font-semibold">
        Ultimate Tracker
      </Link>

      <ul className="mt-6 flex-1 space-y-1">
        {MODULES.map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              aria-current={isActive(pathname, module.href) ? 'page' : undefined}
              className={`block rounded px-3 py-2 text-sm ${
                isActive(pathname, module.href)
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {module.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-gray-200 pt-4">
        <Link
          href="/profile"
          aria-current={isActive(pathname, '/profile') ? 'page' : undefined}
          className={`block rounded px-3 py-2 text-sm ${
            isActive(pathname, '/profile')
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          Profile
        </Link>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-200"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
