'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '@/components/finance/panel';

interface DeleteButtonProps {
  /** What deleting actually does, in a sentence — shown before the second click. */
  prompt: string;
  /** Names the thing being deleted, for the button's accessible label. */
  label: string;
  busy?: boolean;
  onConfirm: () => void;
}

/**
 * Two-step delete, inline rather than window.confirm.
 *
 * A native confirm() cannot say what the deletion costs, and jsdom stubs it out
 * so the second click would go untested. Both branches are exercised in tests.
 * The first step is a quiet trash icon; the second spells the cost out in a
 * tinted strip, so the dangerous click is never the one a stray tap lands on.
 */
export function DeleteButton({ prompt, label, busy = false, onConfirm }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <IconButton label={label} icon={Trash2} tone="danger" onClick={() => setConfirming(true)} />
    );
  }

  return (
    <span
      role="group"
      aria-label="Confirm delete"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-negative-soft px-2 py-1 text-xs"
    >
      <span className="text-negative">{prompt}</span>
      <button
        type="button"
        disabled={busy}
        className="inline-flex items-center rounded-md bg-negative px-2 py-1 font-medium text-white disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Yes, delete
      </button>
      <button
        type="button"
        className="inline-flex items-center rounded-md px-2 py-1 text-fg-muted hover:bg-surface pointer-coarse:min-h-11"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
    </span>
  );
}
