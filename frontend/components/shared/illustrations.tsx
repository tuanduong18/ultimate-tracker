import clsx from 'clsx';

/**
 * Hand-built illustrations, drawn only in theme tokens so they re-colour with
 * the five themes: `primary` for the ink, `primary-soft` and `surface` for the
 * paper. No raster images, nothing fetched — they cost a few hundred bytes and
 * stay sharp at any size.
 *
 * Decorative throughout (aria-hidden): every one sits beside text that already
 * says what it means.
 */

/**
 * A small stack of floating dashboard cards — a rising line, a ring, a few
 * bars and a coin. Stands for "your life, tracked" on the sign-in screens and
 * the dashboard greeting.
 */
export function TrackerIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" aria-hidden className={clsx('h-auto w-full', className)}>
      {/* Backdrop blobs */}
      <circle cx="250" cy="60" r="54" className="fill-primary-soft" />
      <circle cx="58" cy="190" r="40" className="fill-primary-soft" />

      {/* Main card: a rising line chart */}
      <g>
        <rect
          x="40"
          y="40"
          width="200"
          height="132"
          rx="16"
          className="fill-surface stroke-border"
        />
        <rect x="58" y="58" width="64" height="8" rx="4" className="fill-primary-soft" />
        <rect x="58" y="72" width="40" height="6" rx="3" className="fill-primary-soft" />
        <path
          d="M58 150 L92 128 L118 138 L152 104 L184 116 L220 84"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        <path
          d="M58 150 L92 128 L118 138 L152 104 L184 116 L220 84 L220 156 L58 156 Z"
          className="fill-primary opacity-10"
        />
        <circle cx="220" cy="84" r="7" className="fill-surface stroke-primary" strokeWidth="4" />
      </g>

      {/* Ring card */}
      <g>
        <rect
          x="200"
          y="122"
          width="96"
          height="88"
          rx="16"
          className="fill-surface stroke-border"
        />
        <circle
          cx="248"
          cy="166"
          r="24"
          fill="none"
          strokeWidth="9"
          className="stroke-primary-soft"
        />
        <circle
          cx="248"
          cy="166"
          r="24"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="105 151"
          transform="rotate(-90 248 166)"
          className="stroke-primary"
        />
      </g>

      {/* Bars card */}
      <g>
        <rect
          x="18"
          y="104"
          width="78"
          height="76"
          rx="14"
          className="fill-surface stroke-border"
        />
        <rect x="32" y="148" width="10" height="20" rx="3" className="fill-primary opacity-40" />
        <rect x="48" y="134" width="10" height="34" rx="3" className="fill-primary opacity-60" />
        <rect x="64" y="122" width="10" height="46" rx="3" className="fill-primary" />
      </g>

      {/* Coin */}
      <g>
        <circle cx="150" cy="200" r="20" className="fill-primary" />
        <circle
          cx="150"
          cy="200"
          r="14"
          fill="none"
          strokeWidth="2"
          className="stroke-primary-fg opacity-50"
        />
        <text
          x="150"
          y="207"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          className="fill-primary-fg"
        >
          $
        </text>
      </g>

      {/* Sparkles */}
      <path
        d="M286 18 v12 M280 24 h12"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-primary opacity-50"
      />
      <path
        d="M22 50 v10 M17 55 h10"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-primary opacity-50"
      />
    </svg>
  );
}

/**
 * An icon set inside concentric soft rings — the badge on empty states and
 * "coming soon" pages. Takes any icon so each page gets its own.
 */
export function IconBadge({
  icon: Icon,
  size = 'md',
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean; strokeWidth?: number }>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const outer = { sm: 'size-12', md: 'size-16', lg: 'size-28' }[size];
  const inner = { sm: 'size-9', md: 'size-12', lg: 'size-20' }[size];
  const glyph = { sm: 'size-5', md: 'size-6', lg: 'size-10' }[size];

  return (
    <span
      aria-hidden
      className={clsx('flex items-center justify-center rounded-full bg-primary-soft/60', outer)}
    >
      <span
        className={clsx(
          'flex items-center justify-center rounded-full bg-primary-soft text-primary',
          inner
        )}
      >
        <Icon aria-hidden className={glyph} strokeWidth={1.75} />
      </span>
    </span>
  );
}
