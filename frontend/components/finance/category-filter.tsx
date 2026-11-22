'use client';

import { useState } from 'react';

import { FilterMenu } from '@/components/finance/filter-menu';
import { PanelButton } from '@/components/finance/panel';
import { describeError } from '@/lib/hooks/use-collection';
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

/**
 * What a chart opens on: every category but the ones saved as hidden
 * (`chart_hidden_categories` on the profile, saved from either client), and
 * Uncategorised. With none hidden it is ALL_CATEGORIES itself, so a category
 * made later is still counted. Ids of categories deleted since are ignored.
 */
export function savedSelection(
  categories: readonly Category[],
  hidden: readonly string[]
): CategorySelection {
  const shown = categories.filter((category) => !hidden.includes(category.id));
  return shown.length === categories.length
    ? ALL_CATEGORIES
    : { ids: shown.map((category) => category.id), uncategorized: true };
}

/** The categories a selection leaves out, in the user's order — what Save as default stores. */
export function hiddenBy(selection: CategorySelection, categories: readonly Category[]): string[] {
  const { ids } = selection;
  return ids === null
    ? []
    : categories.filter((category) => !ids.includes(category.id)).map((category) => category.id);
}

/** "Rent", "Rent and Food", "Rent, Food and Travel" — names in a sentence. */
export function listNames(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * A chart filter's saved starting point, and the way to change it. Charts
 * only: the Transactions filter has no default to save.
 */
export interface ChartDefaults {
  /** The saved hidden ids, as the profile holds them. */
  hidden: readonly string[];
  /** Back to the saved list, for this look. */
  onReset: () => void;
  /** Stores these ids as the list every chart starts without; rejects if the save fails. */
  onSave: (hidden: string[]) => Promise<void>;
}

interface CategoryFilterProps {
  categories: Category[];
  selection: CategorySelection;
  onChange: (selection: CategorySelection) => void;
  /** Distinguishes the two filters when both are on one page. */
  idPrefix: string;
  /** Charts put the filter at the right of their controls; the Transactions row starts with it. */
  align?: 'start' | 'end';
  defaults?: ChartDefaults;
}

/**
 * A checklist of categories, in a dropdown.
 *
 * A dropdown rather than inline chips because it is off by default: everything
 * is included until someone decides otherwise, so this should cost one line of
 * chrome until it is used. The button says how many are hidden, so a filtered
 * chart never looks like an unfiltered one.
 *
 * **On a chart, ticking is a look and saving is a decision** (`defaults`). The
 * ticks last until the page is left; **Save as default** makes them the list
 * every chart on both clients opens on, and **Reset** comes back to it. Saving
 * each tick as it happened was the alternative: one quick look at Food alone
 * would have become every chart's start, on the phone too, without anyone
 * choosing that. A line says what the charts start without, so the saved list
 * is never a mystery. Uncategorised is not saved — it always starts ticked —
 * and a list that hides every category can't be saved, since it would open
 * every chart on nothing.
 */
export function CategoryFilter({
  categories,
  selection,
  onChange,
  idPrefix,
  align = 'end',
  defaults,
}: CategoryFilterProps) {
  const chosen = selection.ids ?? categories.map((category) => category.id);
  const hidden = categories.length - chosen.length + (selection.uncategorized ? 0 : 1);

  function toggle(id: string) {
    const next = chosen.includes(id)
      ? chosen.filter((existing) => existing !== id)
      : [...chosen, id];
    onChange({ ...selection, ids: next });
  }

  return (
    <FilterMenu
      label={hidden > 0 ? `Categories · ${hidden} hidden` : 'All categories'}
      active={hidden > 0}
      align={align}
    >
      <div className="-m-1 max-h-64 overflow-y-auto">
        <div className="flex gap-2 border-b border-border pb-2 text-xs">
          <button
            type="button"
            className="underline pointer-coarse:min-h-11 pointer-coarse:px-2"
            onClick={() => onChange(ALL_CATEGORIES)}
          >
            Select all
          </button>
          <button
            type="button"
            className="underline pointer-coarse:min-h-11 pointer-coarse:px-2"
            onClick={() => onChange({ ids: [], uncategorized: false })}
          >
            Clear
          </button>
          {defaults && (
            <ResetButton categories={categories} selection={selection} defaults={defaults} />
          )}
        </div>

        <ul className="mt-2 space-y-1">
          {categories.map((category) => (
            <li key={category.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-xs hover:bg-surface-muted pointer-coarse:min-h-11">
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
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-xs hover:bg-surface-muted pointer-coarse:min-h-11"
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

      {defaults && (
        <SavedDefault categories={categories} selection={selection} defaults={defaults} />
      )}
    </FilterMenu>
  );
}

/** The saved hidden ids that still name a category, in the user's order. */
function savedHidden(categories: readonly Category[], defaults: ChartDefaults): string[] {
  return categories
    .filter((category) => defaults.hidden.includes(category.id))
    .map((category) => category.id);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Shown only when it would do something other than Select all: a list is saved, and this isn't it. */
function ResetButton({
  categories,
  selection,
  defaults,
}: {
  categories: Category[];
  selection: CategorySelection;
  defaults: ChartDefaults;
}) {
  const saved = savedHidden(categories, defaults);
  const atSaved = sameIds(hiddenBy(selection, categories), saved) && selection.uncategorized;
  if (saved.length === 0 || atSaved) return null;
  return (
    <button
      type="button"
      className="underline pointer-coarse:min-h-11 pointer-coarse:px-2"
      aria-label="Reset to the categories the charts start with"
      onClick={defaults.onReset}
    >
      Reset
    </button>
  );
}

function SavedDefault({
  categories,
  selection,
  defaults,
}: {
  categories: Category[];
  selection: CategorySelection;
  defaults: ChartDefaults;
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const saved = savedHidden(categories, defaults);
  const now = hiddenBy(selection, categories);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const canSave = !sameIds(now, saved) && now.length < categories.length;

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await defaults.onSave(now);
    } catch (err: unknown) {
      setProblem(describeError(err, 'Could not save that.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      {/* A status, so the new words are heard once a save lands. */}
      <p role="status" className="text-fg-muted">
        {saving
          ? 'Saving…'
          : saved.length
            ? `Charts start without ${listNames(saved.map((id) => names.get(id) ?? ''))}.`
            : 'Charts start with every category.'}
      </p>
      {canSave && (
        <PanelButton onClick={() => void save()} disabled={saving}>
          Save as default
        </PanelButton>
      )}
      {problem && (
        <p role="alert" className="text-negative">
          {problem}
        </p>
      )}
    </div>
  );
}
