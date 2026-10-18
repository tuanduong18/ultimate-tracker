import clsx from 'clsx';

/**
 * The Ultimate Tracker mark: a rising trend line ending in a dot, on a
 * rounded tile.
 *
 * Drawn in theme tokens (`primary` / `primary-fg`) rather than fixed colours,
 * so it re-colours with the five themes like everything else. The favicon in
 * app/icon.svg is the same drawing frozen in the default theme's blue, since a
 * browser tab cannot read the page's CSS.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={clsx('shrink-0', className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M7.5 21.5 12.5 15.5 17 19 24.5 10.5"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-fg"
      />
      <circle cx="24.5" cy="10.5" r="3" className="fill-primary-fg" />
    </svg>
  );
}

/**
 * Mark and name together.
 *
 * The name is real text, so it reads out and scales with the user's font size;
 * the mark beside it is decorative. `nameClassName` lets a caller hide the name
 * visually at some widths — the tablet rail keeps only the mark — while screen
 * readers still get it.
 */
export function Wordmark({
  className,
  nameClassName,
}: {
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark className="size-8" />
      <span className={clsx('leading-tight font-semibold tracking-tight', nameClassName)}>
        Ultimate <span className="text-primary">Tracker</span>
      </span>
    </span>
  );
}
