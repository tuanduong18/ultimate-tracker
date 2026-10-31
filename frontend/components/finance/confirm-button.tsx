'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { IconButton } from '@/components/finance/panel';

interface ConfirmButtonProps {
  /** Names the action and its object, for the icon's accessible label. */
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** What the action actually does, in a sentence — shown before the second click. */
  prompt: string;
  /** The outcome, on the button that goes ahead: "Yes, delete". */
  confirmLabel: string;
  /** The way back, which is also where focus lands when the strip opens. */
  keepLabel: string;
  /** Names the strip for screen readers: "Confirm delete". */
  groupLabel: string;
  /** Danger for an action that cannot be taken back; the default for one that only costs. */
  tone?: 'default' | 'danger';
  /**
   * Extra classes for the strip. A tight row can give it a line of its own
   * (`order-last basis-full` in a wrapping row) rather than squeeze its title.
   */
  stripClassName?: string;
  busy?: boolean;
  onConfirm: () => void;
}

/**
 * Two-step row action, inline rather than window.confirm.
 *
 * A native confirm() cannot say what the action costs, and jsdom stubs it out
 * so the second click would go untested. The first step is a quiet icon; the
 * second spells the cost out in a strip, so the click that commits is never
 * the one a stray tap lands on.
 *
 * Each step replaces the other, so each hands focus on rather than letting it
 * fall to the page: opening the strip focuses the way back — the safe answer,
 * and the one an absent-minded Enter should hit — and closing it, either way,
 * returns focus to the icon. Escape backs out like the way back does.
 */
export function ConfirmButton({
  label,
  icon,
  prompt,
  confirmLabel,
  keepLabel,
  groupLabel,
  tone = 'default',
  stripClassName,
  busy = false,
  onConfirm,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Only a strip that was open hands focus back: on first render the icon
  // must not grab focus for itself.
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) keep.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <IconButton
        ref={trigger}
        label={label}
        icon={icon}
        tone={tone}
        onClick={() => setConfirming(true)}
      />
    );
  }

  const danger = tone === 'danger';
  return (
    <span
      role="group"
      aria-label={groupLabel}
      // The danger strip is tinted; the default one is a plain card on the
      // muted row, so only an action that destroys something reads as alarm.
      className={clsx(
        'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1 text-xs',
        danger ? 'bg-negative-soft' : 'border border-border bg-surface',
        stripClassName
      )}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setConfirming(false);
      }}
    >
      <span className={danger ? 'text-negative' : 'text-fg'}>{prompt}</span>
      <button
        type="button"
        disabled={busy}
        className={clsx(
          'inline-flex items-center rounded-md px-2 py-1 font-medium disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3',
          danger ? 'bg-negative text-negative-fg' : 'bg-primary text-primary-fg'
        )}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button
        ref={keep}
        type="button"
        className={clsx(
          'inline-flex items-center rounded-md px-2 py-1 text-fg-muted pointer-coarse:min-h-11',
          danger ? 'hover:bg-surface' : 'hover:bg-surface-muted'
        )}
        onClick={() => setConfirming(false)}
      >
        {keepLabel}
      </button>
    </span>
  );
}
