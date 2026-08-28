'use client';

import { useState } from 'react';

interface DeleteButtonProps {
  /** What deleting actually does, in a sentence — shown before the second click. */
  prompt: string;
  busy?: boolean;
  onConfirm: () => void;
}

/**
 * Two-step delete, inline rather than window.confirm.
 *
 * A native confirm() cannot say what the deletion costs, and jsdom stubs it out
 * so the second click would go untested. Both branches are exercised in tests.
 */
export function DeleteButton({ prompt, busy = false, onConfirm }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="text-sm text-red-600 underline"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <>
      <span className="text-sm text-gray-500">{prompt}</span>
      <button
        type="button"
        disabled={busy}
        className="text-sm text-red-600 underline disabled:opacity-50"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Yes, delete
      </button>
      <button
        type="button"
        className="text-sm text-gray-500 underline"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
    </>
  );
}
