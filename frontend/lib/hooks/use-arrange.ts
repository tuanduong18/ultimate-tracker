'use client';

import { useState } from 'react';

/** `list` with the entry at `from` taken out and put back at `to`. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

/**
 * The items in the draft's order.
 *
 * One the draft has never seen — added from another device while this list
 * was being arranged — goes first, which is where the server lists anything
 * not yet arranged. One the draft names but the list no longer has is gone.
 */
function inDraftOrder<T extends { id: string }>(items: readonly T[], draft: readonly string[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const known = new Set(draft);
  return [
    ...items.filter((item) => !known.has(item.id)),
    ...draft.flatMap((id) => byId.get(id) ?? []),
  ];
}

/**
 * A list's order while someone arranges it, before it is saved.
 *
 * A draft rather than a request per move. Taking the last budget to the top
 * with the arrow buttons is several moves, and saving each — buttons disabled
 * until the reload landed — made a slow job of a quick one. Nothing is
 * guessed, though: the panel saves the whole order in one request, reloads,
 * and shows what was stored, as after any other write. Cancel drops the draft.
 */
export function useArrange<T extends { id: string }>(items: readonly T[]) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const ordered = draft === null ? [...items] : inDraftOrder(items, draft);

  return {
    arranging: draft !== null,
    /** The items as they should be drawn: in the draft's order while arranging. */
    ordered,
    /** Whether saving would change anything — if not, there is nothing to send. */
    changed: ordered.some((item, index) => item.id !== items[index]?.id),
    start() {
      setDraft(items.map((item) => item.id));
    },
    /** Move the row drawn at `from` so it is drawn at `to`. */
    move(from: number, to: number) {
      setDraft((current) =>
        current === null
          ? null
          : moved(
              inDraftOrder(items, current).map((item) => item.id),
              from,
              to
            )
      );
    },
    /** Leave arranging: after a save has landed, or to cancel. */
    stop() {
      setDraft(null);
    },
  };
}
