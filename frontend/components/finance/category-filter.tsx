'use client';

import { useEffect, useRef, useState } from 'react';

import type { Category } from '@/lib/types/finance';

/**
 * Which categories a chart is built from.
 *
 * `null` means every category, which is not the same as a list that happens to
 * contain them all: a category created after the chart was opened is included
 * by the first and missed by the second. The default has to keep working for
 * data that does not exist yet.
 */
export interface CategorySelection {
  ids: string[] | null;
  /** The bucket holding spend whose category was deleted; it has no id. */
  uncategorized: boolean;
}

export const ALL_CATEGORIES: CategorySelection = { ids: null, uncategorized: true };

/** Query string for the breakdown endpoints, empty while nothing is excluded. */
export function selectionQuery(selection: CategorySelection): string {
  const parts = (selection.ids ?? []).map((id) => `category_ids=${encodeURIComponent(id)}`);
  // Only worth sending when it differs from the server's default. With no ids
  // alongside it, the API reads it as "every named category, minus the bucket".
  if (!selection.uncategorized) parts.push('include_uncategorized=false');
  return parts.length ? `&${parts.join('&')}` : '';
}

/** Nothing ticked at all — worth catching before asking the API for an empty chart. */
export function isEmptySelection(selection: CategorySelection): boolean {
  return selection.ids !== null && selection.ids.length === 0 && !selection.uncategorized;
}

interface CategoryFilterProps {
  categories: Category[];
  selection: CategorySelection;
  onChange: (selection: CategorySelection) => void;
  /** Distinguishes the two filters when both are on one page. */
  idPrefix: string;
}

/**
 * A checklist of categories, in a dropdown.
 *
 * A dropdown rather than inline chips because it is off by default: everything
 * is included until someone decides otherwise, so this should cost one line of
 * chrome until it is used. The button says how many are hidden, so a filtered
 * chart never looks like an unfiltered one.
 */
export function CategoryFilter({ categories, selection, onChange, idPrefix }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const chosen = selection.ids ?? categories.map((category) => category.id);
  const hidden = categories.length - chosen.length + (selection.uncategorized ? 0 : 1);

  function toggle(id: string) {
    const next = chosen.includes(id)
      ? chosen.filter((existing) => existing !== id)
      : [...chosen, id];
    onChange({ ...selection, ids: next });
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        className="rounded-full border px-2.5 py-1 text-xs hover:bg-primary-soft"
        onClick={() => setOpen((was) => !was)}
      >
        {hidden > 0 ? `Categories · ${hidden} hidden` : 'All categories'}
      </button>

      {open && (
        <div
          // Above the chart rather than pushing it down, so opening the filter
          // does not resize the thing you are filtering.
          className="absolute right-0 z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <div className="flex gap-2 border-b border-border pb-2 text-xs">
            <button type="button" className="underline" onClick={() => onChange(ALL_CATEGORIES)}>
              Select all
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => onChange({ ids: [], uncategorized: false })}
            >
              Clear
            </button>
          </div>

          <ul className="mt-2 space-y-1">
            {categories.map((category) => (
              <li key={category.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-xs hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    checked={chosen.includes(category.id)}
                    onChange={() => toggle(category.id)}
                  />
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.colour }}
                  />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                </label>
              </li>
            ))}

            <li>
              <label
                className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-xs hover:bg-surface-muted"
                htmlFor={`${idPrefix}-uncategorised`}
              >
                <input
                  id={`${idPrefix}-uncategorised`}
                  type="checkbox"
                  checked={selection.uncategorized}
                  onChange={() =>
                    onChange({
                      // Switching this alone has to pin the category list too,
                      // or "everything" would silently switch it back on.
                      ids: selection.ids ?? categories.map((category) => category.id),
                      uncategorized: !selection.uncategorized,
                    })
                  }
                />
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-fg/10" />
                <span className="min-w-0 flex-1 truncate text-fg-muted">Uncategorised</span>
              </label>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
