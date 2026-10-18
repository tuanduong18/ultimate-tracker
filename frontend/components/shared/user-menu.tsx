'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { ACCOUNT_LINKS, isActive } from '@/components/shared/nav-items';
import { useSession } from '@/lib/hooks/use-session';
import { supabase } from '@/lib/supabase';

/** "tuan@example.com" → "T". One letter reads cleanly at avatar size. */
function initialOf(email: string | undefined): string {
  const first = email?.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

/**
 * The account menu behind the avatar, top right: who is signed in, Profile,
 * Settings and Log out.
 *
 * Built as a disclosure — a button that shows and hides a list of links —
 * rather than an ARIA `menu`. The menu role promises application-menu keyboard
 * behaviour (arrow keys, typeahead) that a short list of links does not need,
 * and screen readers announce it differently. Escape and a click anywhere
 * outside close it; Escape also hands focus back to the button.
 *
 * Log out stays one click from the open menu rather than being buried a level
 * deeper, for anyone on a shared computer who needs it quickly.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const { session } = useSession();
  const email = session?.user.email;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 items-center gap-1 rounded-full pr-2 pl-1 hover:bg-primary-soft"
      >
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg"
        >
          {initialOf(email)}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 text-fg-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          {email && (
            <p className="truncate border-b border-border px-3 pt-1 pb-3 text-xs text-fg-muted">
              Signed in as
              <span className="block truncate text-sm text-fg">{email}</span>
            </p>
          )}

          <ul className="space-y-0.5 py-1">
            {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-primary-soft aria-[current=page]:font-semibold"
                >
                  <Icon aria-hidden className="size-4 text-fg-muted" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-border pt-1">
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-primary-soft"
            >
              <LogOut aria-hidden className="size-4 text-fg-muted" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
