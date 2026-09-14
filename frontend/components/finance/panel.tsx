'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * The card every quadrant of the finance dashboard is drawn in.
 *
 * The three along the bottom row are fixed-height and scroll their own body:
 * the whole point of the layout is that the four panels stay in view together,
 * which a panel that grows with its list would break. The header and any error
 * sit outside that scroll area so neither can be scrolled out of sight.
 */
interface PanelProps {
  title: string;
  /** Rendered at the right of the title row — the add / see-all buttons. */
  action?: ReactNode;
  /**
   * A second row under the title, for controls that belong to the panel rather
   * than to one item in it — the charts' range picker. Outside the scroll area,
   * so it cannot be scrolled away from the thing it controls.
   */
  header?: ReactNode;
  /** Whatever the collection this panel owns last failed at. */
  error?: string | null;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, action, header, error, children, className }: PanelProps) {
  return (
    <section
      className={clsx(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface',
        className
      )}
    >
      <div className="shrink-0 border-b border-border">
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="truncate text-sm font-medium">{title}</h2>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
        {header && <div className="px-4 pb-3">{header}</div>}
      </div>

      {error && (
        <p
          role="alert"
          className="shrink-0 border-b border-negative/30 bg-negative-soft px-4 py-2 text-sm text-negative"
        >
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

/**
 * The small outline button panels put in their header.
 *
 * `label` is there because the narrowest panel has room for "New" and not for
 * "New category" — the short word is what gets drawn, and the full one is what
 * a screen reader announces.
 */
export function PanelButton({
  children,
  onClick,
  disabled,
  title,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border px-2 py-1 text-xs whitespace-nowrap hover:bg-primary-soft disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Centred grey text for the loading and empty states, which every panel has. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="p-6 text-center text-sm text-fg-muted">{children}</p>;
}
