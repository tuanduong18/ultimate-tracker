'use client';

import { useState } from 'react';

import { DeleteButton } from '@/components/finance/delete-button';
import { Panel, PanelButton, PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import type { Category } from '@/lib/types/finance';

const DEFAULT_COLOUR = '#94a3b8';

interface CategorySectionProps {
  /**
   * Owned by the page, not by this section: the expense and budget forms pick
   * from the same list, and two copies of it drift the moment one is edited.
   */
  categories: Collection<Category>;
  /** Deleting a category uncategorises its expenses, so that list goes stale. */
  onChange: () => void;
}

/**
 * Category CRUD, as the narrow left column of the dashboard's bottom row.
 *
 * Every category is listed rather than a newest-few, because unlike expenses
 * the set is small, bounded, and the reason to look at it at all is to find the
 * one you want to rename. The panel scrolls when it outgrows its height.
 */
export function CategorySection({ categories, onChange }: CategorySectionProps) {
  const { items, loading, error, reload, setError } = categories;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColour, setEditColour] = useState(DEFAULT_COLOUR);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      onChange();
      return true;
    } catch (err: unknown) {
      setError(describeError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await run(
      () => api.post('/finance/categories', { name, colour }),
      'Could not create that category.'
    );
    if (created) {
      setName('');
      setColour(DEFAULT_COLOUR);
      setAdding(false);
    }
  }

  /**
   * Save both fields, because a category is its name *and* its colour.
   *
   * The colour is the one thing about a category that shows up somewhere other
   * than this list — it is the slice in the pie and the wash on a budget card —
   * so being unable to change it after creation is the gap worth closing here.
   */
  async function handleEdit(id: string) {
    const saved = await run(
      () => api.patch(`/finance/categories/${id}`, { name: editName, colour: editColour }),
      'Could not update that category.'
    );
    if (saved) setEditing(null);
  }

  async function handleDelete(id: string) {
    await run(() => api.delete(`/finance/categories/${id}`), 'Could not delete that category.');
  }

  return (
    <Panel
      title="Categories"
      error={error}
      className="h-full"
      action={
        <PanelButton
          label={adding ? 'Cancel' : 'New category'}
          onClick={() => setAdding((open) => !open)}
        >
          {adding ? 'Cancel' : 'New'}
        </PanelButton>
      }
    >
      {adding && (
        <form className="space-y-2 border-b border-gray-200 bg-gray-50 p-3" onSubmit={handleCreate}>
          <div>
            <label className="block text-xs text-gray-600" htmlFor="category-name">
              Name
            </label>
            <input
              id="category-name"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-600" htmlFor="category-colour">
                Colour
              </label>
              <input
                id="category-colour"
                className="mt-1 h-8 w-12 rounded border"
                type="color"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : items.length === 0 ? (
        !adding && <PanelNote>No categories yet. Create one before setting a budget.</PanelNote>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((category) =>
            editing === category.id ? (
              // The swatch becomes the colour input, so the thing being edited
              // sits where the thing it changes was. Stacked rather than one
              // row: this panel is the narrowest on the page.
              <li key={category.id} className="space-y-2 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Colour for ${category.name}`}
                    className="h-7 w-8 shrink-0 rounded border"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                  />
                  <input
                    aria-label={`Rename ${category.name}`}
                    className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                    value={editName}
                    maxLength={50}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs underline disabled:opacity-50"
                    onClick={() => void handleEdit(category.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 underline"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={category.id} className="flex items-center gap-2 px-3 py-2.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: category.colour }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>

                <button
                  type="button"
                  className="shrink-0 text-xs underline"
                  onClick={() => {
                    setEditing(category.id);
                    setEditName(category.name);
                    setEditColour(category.colour);
                  }}
                >
                  Rename
                </button>
                <DeleteButton
                  prompt="Delete? Its expenses become uncategorised."
                  busy={busy}
                  onConfirm={() => void handleDelete(category.id)}
                />
              </li>
            )
          )}
        </ul>
      )}
    </Panel>
  );
}
