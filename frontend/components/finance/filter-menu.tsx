'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface FilterMenuProps {
  /** What the button says: the filter's current value, never just its name. */
  label: string;
  /** Narrowing something right now — drawn with a border as well as a tint. */
  active?: boolean;
  /** Which edge the menu lines up with; `end` for a button at the right of a row. */
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

/**
 * A pill that opens a small panel of filter controls under it.
 *
 * One component for every filter on a row — categories, dates, amounts — so
 * they open, close and look the same: click outside or Escape closes, and
 * Escape puts focus back on the pill rather than dropping it to <body>.
 *
 * The pill's text is the filter's value ("Aug 2026", "SGD 10 – 50"), not its
 * name, so a filtered list never looks like an unfiltered one; `active` adds a
 * primary border on top of the tint so the state survives forced colours and
 * does not rest on colour alone.
 *
 * A disclosure rather than `popover="auto"`: the panel holds form fields, and
 * the hand-rolled version is what NotificationBell and UserMenu already use.
 */
export function FilterMenu({
  label,
  active = false,
  align = 'start',
  className,
  children,
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={clsx('relative', className)} ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={clsx(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap pointer-coarse:min-h-11 pointer-coarse:px-4',
          active ? 'border-primary bg-primary-soft text-fg' : 'hover:bg-primary-soft'
        )}
        onClick={() => setOpen((was) => !was)}
      >
        {label}
        <ChevronDown
          aria-hidden
          className={clsx('size-3.5 transition-transform motion-reduce:transition-none', {
            'rotate-180': open,
          })}
        />
      </button>

      {open && (
        <div
          id={panelId}
          // Over the list rather than pushing it down, so opening a filter does
          // not move the rows it is about to filter. Capped to the viewport so
          // a menu opened near a phone's edge stays on screen.
          className={clsx(
            'absolute z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 text-xs shadow-lg',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
