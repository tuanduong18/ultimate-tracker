'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { MODULES, isActive } from '@/components/shared/nav-items';
import { NavDrawer } from '@/components/shared/nav-drawer';

/** The modules that get a tab of their own; the rest sit behind More. */
const TABBED = MODULES.slice(0, 4);

/**
 * The phone navigation: a tab bar along the bottom, below md.
 *
 * Replaces a menu button in the header. Navigation hidden behind a menu icon
 * is used markedly less and found later than navigation in plain sight
 * (NN/g's study of 179 people), and the top-left corner is the hardest place
 * on a phone to reach with a thumb. The four most-used modules sit where the
 * thumb already is; More opens the full drawer for the rest.
 *
 * The current tab is marked three ways — aria-current, a filled pill behind the
 * icon, and the primary colour — so it reads without relying on colour.
 * Padded by the device's safe area, so the bar clears the home indicator.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moreActive = !TABBED.some(({ href }) => isActive(pathname, href));

  const item =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';
  const pill = 'flex h-7 w-12 items-center justify-center rounded-full transition-colors';

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        <ul className="flex">
          {TABBED.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`${item} ${active ? 'text-primary' : 'text-fg-muted'}`}
                >
                  <span aria-hidden className={`${pill} ${active ? 'bg-primary-soft' : ''}`}>
                    <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="nav-drawer"
              className={`${item} ${moreActive ? 'text-primary' : 'text-fg-muted'}`}
            >
              <span aria-hidden className={`${pill} ${moreActive ? 'bg-primary-soft' : ''}`}>
                <Menu className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
