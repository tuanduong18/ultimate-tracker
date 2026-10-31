'use client';

import { Trash2 } from 'lucide-react';

import { ConfirmButton } from '@/components/finance/confirm-button';

interface DeleteButtonProps {
  /** What deleting actually does, in a sentence — shown before the second click. */
  prompt: string;
  /** Names the thing being deleted, for the button's accessible label. */
  label: string;
  /** See ConfirmButton: lets a tight row give the strip a line of its own. */
  stripClassName?: string;
  busy?: boolean;
  onConfirm: () => void;
}

/**
 * Two-step delete: a quiet trash icon, then the cost spelled out in a tinted
 * strip with "Yes, delete" and "Keep". The steps and their focus hand-offs are
 * ConfirmButton's; this fixes the words and the danger tone, so every delete
 * in the app reads the same.
 */
export function DeleteButton({
  prompt,
  label,
  stripClassName,
  busy = false,
  onConfirm,
}: DeleteButtonProps) {
  return (
    <ConfirmButton
      label={label}
      icon={Trash2}
      prompt={prompt}
      confirmLabel="Yes, delete"
      keepLabel="Keep"
      groupLabel="Confirm delete"
      tone="danger"
      stripClassName={stripClassName}
      busy={busy}
      onConfirm={onConfirm}
    />
  );
}
