/**
 * Putting a list in the person's own order — the phone's copies of `moved` and `inDraftOrder`
 * from the web's lib/hooks/use-arrange.ts. Arranging edits a draft; the whole order is saved in
 * one request at the end, then reloaded, as after any other write.
 */

/** `list` with the entry at `from` taken out and put back at `to`. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

/**
 * The items in the draft's order. One the draft has never seen — added from another device while
 * this list was being arranged — goes first, which is where the server lists anything not yet
 * arranged. One the draft names but the list no longer has is gone.
 */
export function inDraftOrder<T extends { id: string }>(
  items: readonly T[],
  draft: readonly string[]
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const known = new Set(draft);
  return [
    ...items.filter((item) => !known.has(item.id)),
    ...draft.flatMap((id) => byId.get(id) ?? []),
  ];
}

/** Whether saving `ordered` would change anything against the stored order. */
export function orderChanged(
  ordered: readonly { id: string }[],
  stored: readonly { id: string }[]
): boolean {
  return ordered.length !== stored.length || ordered.some((item, i) => item.id !== stored[i]?.id);
}
