'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Every Finance tab, in the order people need them: look, then log, then plan. */
export const FINANCE_TABS = [
  { href: '/finance', label: 'Overview' },
  { href: '/finance/expenses', label: 'Transactions' },
  { href: '/finance/budgets', label: 'Budgets' },
  { href: '/finance/subscriptions', label: 'Subscriptions' },
  { href: '/finance/categories', label: 'Categories' },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  // Overview is the section root, so only an exact match counts for it.
  return href === '/finance' ? pathname === href : pathname.startsWith(href);
}

/**
 * The finance sections, as tabs under the page title.
 *
 * Finance used to be one page of six panels — charts, four lists and every
 * form — which made the overview too busy to glance at and each list too
 * narrow to work in. Now the overview is for looking, and each thing you
 * manage has a whole page.
 *
 * Links, not ARIA tabs: each one is a real route with its own URL and back
 * button, which is what the `tab` role does not promise. The current one is
 * marked with aria-current and an underline — a shape, not just a colour.
 * On a phone the row scrolls sideways rather than wrapping into two lines.
 */
export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Finance sections" className="-mx-4 mt-5 border-b border-border sm:mx-0">
      <ul className="flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-0">
        {FINANCE_TABS.map(({ href, label }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`relative inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${
                  current ? 'text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {label}
                {current && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
