'use client';

import { useEffect, useRef } from 'react';

/** Where focus should land once the next render has put the list in its new shape. */
type Pending =
  /** A row's inline editor closed: back to that row. */
  | { kind: 'row'; id: string }
  /** A row was deleted: its neighbour, once the reload without it has landed. */
  | { kind: 'removed'; index: number; before: unknown }
  /** The add form closed: the panel's own button that opened it. */
  | { kind: 'action' };

/**
 * Keep keyboard focus in place while a panel's rows come and go.
 *
 * Every list here swaps elements out from under the focus: saving an edit
 * unmounts the form, deleting a row unmounts the row. When the focused element
 * disappears the browser drops focus to <body>, and someone on a keyboard or a
 * screen reader is thrown back to the top of the page with no idea where the
 * thing they were working on went. This puts them back beside it instead.
 *
 * The panel's root takes `panelRef`, and each row in its resting (not editing)
 * state carries `data-row-id={id}` — a plain attribute rather than a helper
 * from this hook, since anything read off the hook's result during render
 * counts as reading a ref. Focus lands on the first button in a row — its
 * edit button — or, when the list has emptied, on the panel's header button
 * (or its heading, if it has none).
 *
 * Deletion waits for `items` to change rather than firing on the next render:
 * the row is still on screen until the reload lands, and focusing its
 * neighbour before then would pick the wrong one.
 */
export function useRowFocus(items: unknown) {
  const panelRef = useRef<HTMLElement>(null);
  const pending = useRef<Pending | null>(null);

  // Every render, deliberately: the target may only exist after a re-render
  // this hook does not otherwise hear about (an editor closing).
  useEffect(() => {
    const target = pending.current;
    const panel = panelRef.current;
    if (!target || !panel) return;

    if (target.kind === 'removed' && items === target.before) return;

    const rows = [...panel.querySelectorAll<HTMLElement>('[data-row-id]')];
    let element: HTMLElement | null | undefined;
    if (target.kind === 'row') {
      element = rows.find((row) => row.dataset.rowId === target.id)?.querySelector('button');
      if (!element) return;
    } else if (target.kind === 'removed' && rows.length > 0) {
      element = rows[Math.min(target.index, rows.length - 1)].querySelector('button');
    }
    // In priority order, not document order: the heading comes first in the
    // DOM, but a button is the better place to land when there is one.
    element ??=
      panel.querySelector<HTMLElement>('header button, header a') ??
      panel.querySelector<HTMLElement>('header h2');

    pending.current = null;
    element?.focus();
  });

  return {
    panelRef,
    /** Call as a row's editor closes, whether it saved or was cancelled. */
    returnToRow(id: string) {
      pending.current = { kind: 'row', id };
    },
    /** Call just before deleting the row with this id. */
    removing(id: string) {
      const rows = [...(panelRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [])];
      const index = Math.max(
        0,
        rows.findIndex((row) => row.dataset.rowId === id)
      );
      pending.current = { kind: 'removed', index, before: items };
    },
    /** Call as the add form closes. */
    returnToAction() {
      pending.current = { kind: 'action' };
    },
    /**
     * Call when a delete fails. The row is still there and so is focus — on its
     * delete button — so a later, unrelated reload must not move it.
     */
    cancel() {
      pending.current = null;
    },
  };
}
