import type { ReactNode } from 'react';

/**
 * The title block at the top of every signed-in page.
 *
 * One component so every page starts at the same height with the same type
 * scale — the drift between hand-written headings is what makes an app feel
 * assembled rather than designed. `actions` sits to the right on wide screens
 * and drops under the title on narrow ones.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
