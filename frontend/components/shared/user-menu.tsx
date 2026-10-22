'use client';

import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { ACCOUNT_LINKS, isActive } from '@/components/shared/nav-items';
import { useTheme } from '@/components/shared/theme-provider';
import { useResource } from '@/lib/hooks/use-collection';
import { useSession } from '@/lib/hooks/use-session';
import { PROFILE_CHANGED, displayNameOf, initialOf } from '@/lib/identity';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types/profile';

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
 *
 * Dark mode sits here too, as the one appearance setting worth a shortcut: it
 * is the one people change with the room — the lights go down, the screen
 * should too. See DarkModeSwitch.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const { session } = useSession();
  const profile = useResource<Profile>('/auth/me');
  const { reload } = profile;
  const email = session?.user.email;
  // Until the profile lands — or if it fails — the provider's name and then
  // the email stand in, so the avatar never waits on the API.
  const name = displayNameOf(profile.data, session?.user);

  // This menu lives in the layout and never remounts, so a name saved on
  // /profile would otherwise not show here until a full reload.
  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(PROFILE_CHANGED, onChange);
    return () => window.removeEventListener(PROFILE_CHANGED, onChange);
  }, [reload]);

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
          {initialOf(name, email)}
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
              {name && <span className="block truncate text-sm font-medium text-fg">{name}</span>}
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

          <div className="border-t border-border py-1">
            <DarkModeSwitch />
          </div>

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

/**
 * A labelled switch rather than a bare sun/moon button.
 *
 * An icon alone cannot say whether the sun means "it is light now" or "make it
 * light", and people guess both ways; a switch called "Dark mode" that is on or
 * off has one reading. Flipping it chooses light or dark outright, ending any
 * "match system" — the person is overriding the device on purpose. Going back
 * to following the device lives on /settings with the colour schemes. The menu
 * stays open so the change can be seen, and undone, in place.
 */
function DarkModeSwitch() {
  const { mode, setMode, resolvedMode } = useTheme();
  const dark = resolvedMode === 'dark';
  const Icon = dark ? Moon : Sun;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setMode(dark ? 'light' : 'dark')}
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-primary-soft"
    >
      <Icon aria-hidden className="size-4 text-fg-muted" />
      <span className="flex-1">
        Dark mode
        {mode === 'system' && (
          <span className="block text-xs text-fg-muted">Following your device</span>
        )}
      </span>
      {/* The track: a shape that moves, so on and off differ by more than colour. */}
      <span
        aria-hidden
        className={`flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors motion-reduce:transition-none ${
          dark ? 'border-primary bg-primary' : 'border-border-control bg-surface-muted'
        }`}
      >
        <span
          className={`size-3.5 rounded-full transition-transform motion-reduce:transition-none ${
            dark ? 'translate-x-4 bg-primary-fg' : 'translate-x-0.5 bg-fg-muted'
          }`}
        />
      </span>
    </button>
  );
}
