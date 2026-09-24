'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { supabase } from '@/lib/supabase';

/**
 * Every signed-in destination, in the order the sidebar lists them.
 *
 * Fitness absorbed the former Steps and Wellness entries — see
 * docs/features/fitness.md. Gaming sits last on purpose: it is the most
 * interesting domain to build, so it is scheduled after the rest are done.
 */
export const MODULES = [
  { href: '/dashboard', label: 'Dashboard', blurb: 'Everything at a glance' },
  { href: '/finance', label: 'Finance', blurb: 'Expenses, budgets and subscriptions' },
  { href: '/fitness', label: 'Fitness', blurb: 'Training, steps, sleep and habits' },
  { href: '/time', label: 'Time', blurb: 'Where the hours go, and what is coming' },
  { href: '/insights', label: 'Insights', blurb: 'How the domains connect' },
  { href: '/gaming', label: 'Gaming', blurb: 'Match history and performance' },
] as const;

/** Below the divider: preferences rather than places to log something. */
export const ACCOUNT_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string): boolean {
  // Prefix match so /finance/budgets keeps the Finance item highlighted.
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-muted p-4">
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
                  ? 'bg-primary text-primary-fg'
                  : 'text-fg hover:bg-primary-soft'
              }`}
            >
              {module.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-border pt-4">
        {ACCOUNT_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(pathname, link.href) ? 'page' : undefined}
            className={`block rounded px-3 py-2 text-sm ${
              isActive(pathname, link.href)
                ? 'bg-primary text-primary-fg'
                : 'text-fg hover:bg-primary-soft'
            }`}
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="block w-full rounded px-3 py-2 text-left text-sm text-fg hover:bg-primary-soft"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
