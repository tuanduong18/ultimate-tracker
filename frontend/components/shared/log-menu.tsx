'use client';

import { Plus, Receipt } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentType } from 'react';

import { AddExpenseDialog } from '@/components/finance/quick-add-expense';

interface Logger {
  id: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  Dialog: ComponentType<{ open: boolean; onClose: () => void }>;
}

/**
 * Everything that can be logged, one row per module that can log.
 *
 * Only live modules belong here. When Fitness ships, "Workout" is a new row —
 * not a new button in the header — so the header keeps one shape however many
 * modules arrive.
 */
const LOGGERS: readonly Logger[] = [
  {
    id: 'expense',
    label: 'Expense',
    hint: 'Something you paid for',
    icon: Receipt,
    Dialog: AddExpenseDialog,
  },
];

/**
 * The header's Log button: log anything, from any page.
 *
 * Logging is the core loop of a tracker and happens in a hurry, so it is one
 * tap from everywhere. But it is one *app-wide* button with a short menu, not
 * a button per module: "Add expense" in the global header would sit above
 * every other module's pages once they ship, and crown one module over the
 * rest. The menu costs a tap while it has a single row; in exchange, people
 * learn "Log, then pick" once and it never changes.
 *
 * A disclosure — a button showing a list of buttons — like the account menu,
 * not an ARIA `menu`, whose arrow-key contract a short list does not need.
 * The dialog it opens outlives the menu item that opened it, so focus is
 * handed back to the Log button by hand when the dialog closes.
 */
export function LogMenu() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-fg shadow-xs transition-opacity hover:opacity-90"
      >
        <Plus aria-hidden className="size-4" />
        Log
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-3 pt-1 pb-2 text-xs text-fg-muted">What would you like to log?</p>
          <ul className="space-y-0.5">
            {LOGGERS.map(({ id, label, hint, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setOpen(false);
                    setActive(id);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-fg-muted">{hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {LOGGERS.map(({ id, Dialog }) => (
        <Dialog
          key={id}
          open={active === id}
          onClose={() => {
            setActive(null);
            button.current?.focus();
          }}
        />
      ))}
    </div>
  );
}
