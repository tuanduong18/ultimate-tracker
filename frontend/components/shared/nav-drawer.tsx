'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { ModuleLinks } from '@/components/shared/app-nav';
import { Wordmark } from '@/components/shared/brand';

/**
 * The phone navigation: a panel that slides in from the left.
 *
 * Built on a native <dialog> opened with showModal(), which gives the behaviour
 * a modal drawer owes keyboard and screen-reader users for free — focus moves
 * inside, Tab cannot wander to the page behind (the browser makes it inert),
 * Escape closes it, and focus returns to the menu button afterwards.
 *
 * The links are only rendered while it is open, so a closed drawer contributes
 * nothing to the accessibility tree or to queries for "the Finance link".
 */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="nav-drawer"
      aria-label="Navigation"
      // Escape fires `cancel` and then `close`; listening to `close` alone keeps
      // React's state in step however the dialog was dismissed.
      onClose={onClose}
      // A click that lands on the dialog element itself, rather than on
      // anything inside it, was a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r border-border bg-surface-muted p-0 text-fg shadow-xl transition-transform duration-200 ease-out backdrop:bg-black/40 motion-reduce:transition-none starting:open:-translate-x-full"
    >
      {open && (
        <div className="flex h-full flex-col p-3">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex min-h-11 items-center rounded-lg px-2 text-lg"
            >
              <Wordmark />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex size-11 items-center justify-center rounded-lg hover:bg-primary-soft"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto">
            <ModuleLinks variant="drawer" onNavigate={onClose} />
          </nav>
        </div>
      )}
    </dialog>
  );
}
