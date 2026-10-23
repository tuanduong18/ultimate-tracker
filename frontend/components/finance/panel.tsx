'use client';

import clsx from 'clsx';
import type { ReactNode, Ref } from 'react';

import { IconBadge } from '@/components/shared/illustrations';

/**
 * The card every panel of the finance dashboard is drawn in.
 *
 * The four along the bottom row are fixed-height and scroll their own body:
 * the whole point of the layout is that every panel stays in view together,
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
  /** For `useRowFocus`, which looks inside the panel for where focus should go. */
  ref?: Ref<HTMLElement>;
}

export function Panel({ title, action, header, error, children, className, ref }: PanelProps) {
  return (
    <section
      ref={ref}
      className={clsx(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs',
        className
      )}
    >
      <div className="shrink-0 border-b border-border">
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          {/* Focusable by script only (tabIndex -1): where focus lands when the
              last row of a list is deleted and the header has no button. */}
          <h2 tabIndex={-1} className="truncate text-sm font-semibold focus:outline-none">
            {title}
          </h2>
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
      className="rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap hover:bg-primary-soft disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3"
    >
      {children}
    </button>
  );
}

/**
 * Centred grey text for the loading and empty states, which every panel has.
 *
 * Panels skip the empty state while their load has failed: "No budgets yet"
 * under "Could not load this list" claims an emptiness nobody has seen.
 */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="p-6 text-center text-sm text-fg-muted">{children}</p>;
}

/**
 * A square icon-only button for row actions — edit, rename, delete.
 *
 * Icons rather than underlined words, because a column of "Edit Delete" text
 * on every row is the noisiest thing on the page. The label still reaches
 * screen readers (aria-label) and mouse users (title), and names the row it
 * acts on, so a list of ten does not read as ten identical "Delete" buttons.
 * 32px for a mouse, 44px on touch screens.
 */
export function IconButton({
  label,
  icon: Icon,
  onClick,
  tone = 'default',
  disabled,
  ref,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors disabled:opacity-50 pointer-coarse:size-11',
        tone === 'danger'
          ? 'hover:bg-negative-soft hover:text-negative'
          : 'hover:bg-surface hover:text-fg'
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

/**
 * The empty state: an icon in a soft badge above the sentence that explains it.
 *
 * The icon says at a glance which panel is empty; the sentence says what
 * would fill it. Wording stays the same as PanelNote's — only the frame
 * changed — so nothing about what a user is told moves.
 */
export function PanelEmpty({
  icon,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean; strokeWidth?: number }>;
  children: ReactNode;
  /** The way out, when there is one on the spot — "Clear filters". */
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <IconBadge icon={icon} size="sm" />
      <p className="max-w-60 text-sm text-fg-muted">{children}</p>
      {action}
    </div>
  );
}
