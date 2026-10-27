'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A focused task in a modal: centred on a desktop, a sheet rising from the
 * bottom on a phone, where the thumb is.
 *
 * Built on a native <dialog>: focus moves inside, the page behind goes inert,
 * Escape closes it. Native focus return goes to whatever opened it; a caller
 * whose opener disappears (a menu item) moves focus itself in `onClose`.
 *
 * The body is mounted only while open, so a page with the button does not
 * fetch what the dialog needs until someone asks, and a closed dialog leaves
 * nothing in the accessibility tree. Used by Add expense and Import expenses.
 */
export function SheetDialog({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The id of the heading inside — SheetHeader's `titleId`. */
  labelledBy: string;
  children: ReactNode;
}) {
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
      aria-labelledby={labelledBy}
      // Escape fires `cancel` then `close`; listening to `close` keeps React's
      // state in step however the dialog was dismissed.
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // overflow-y-auto, not hidden: the browser caps a modal's height at the
      // viewport, and a long body (an import's problem list) must scroll
      // rather than be cut off. Scrolling still clips to the rounded corners.
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-0 text-fg shadow-xl transition duration-200 ease-out backdrop:bg-black/40 motion-reduce:transition-none max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none max-sm:border-b-0 max-sm:starting:open:translate-y-full sm:starting:open:scale-95 sm:starting:open:opacity-0"
    >
      {open && <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>}
    </dialog>
  );
}

/**
 * The dialog's title row: its heading, and a 44px close button. Sticky, so
 * the way out stays in reach while a long body scrolls under it.
 */
export function SheetHeader({
  titleId,
  title,
  onClose,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-5 py-3">
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex size-11 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <X aria-hidden className="size-5" />
      </button>
    </header>
  );
}
