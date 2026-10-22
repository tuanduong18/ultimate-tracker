'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Wordmark } from '@/components/shared/brand';
import { MODULES, isActive } from '@/components/shared/nav-items';

/**
 * The module links, from one list so the layouts cannot drift apart.
 *
 * - `persistent`: Material's navigation rail on tablets — icon over a short
 *   label — widening into a sidebar row (icon beside label) from lg.
 * - `drawer`: the sidebar row, inside the phone's slide-out drawer.
 *
 * Every link is at least 44px tall — Apple's minimum touch target, and well
 * clear of WCAG 2.2's 24px floor.
 */
export function ModuleLinks({
  variant,
  onNavigate,
}: {
  variant: 'persistent' | 'drawer';
  /** Called after a link is followed — the drawer closes itself with it. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const shape =
    variant === 'persistent'
      ? 'flex-col justify-center gap-1 px-1 py-2 text-[11px] font-medium lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-sm lg:font-normal'
      : 'gap-3 px-3 text-sm';

  return (
    <ul className="space-y-1">
      {MODULES.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-lg ${shape} ${
                active ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-primary-soft'
              }`}
            >
              <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Persistent navigation from md up: a rail on tablets, a sidebar on desktops.
 *
 * Kept visible rather than tucked behind a menu icon at these widths. Hidden
 * navigation measurably costs discoverability, and costs most on desktop —
 * the hamburger only earns its place where the screen cannot spare the room.
 */
export function AppSidebar() {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-border bg-surface-muted px-2 py-4 md:flex lg:w-60 lg:px-3"
    >
      <Link
        href="/dashboard"
        className="mb-6 flex min-h-11 items-center justify-center rounded-lg px-1 lg:justify-start lg:px-2"
      >
        {/* The full name needs the sidebar's width; the rail keeps the mark. */}
        <Wordmark nameClassName="sr-only lg:not-sr-only lg:text-lg" />
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ModuleLinks variant="persistent" />
      </div>

      <p className="hidden px-3 pt-4 text-xs text-fg-muted lg:block">
        One app for money, body and time.
      </p>
    </nav>
  );
}
