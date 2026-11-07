'use client';

import { Pencil, Tags } from 'lucide-react';
import { useState } from 'react';

import { ArrangeActions, ArrangeList } from '@/components/finance/arrange-list';
import { CategoryBadge } from '@/components/finance/category-badge';
import { DeleteButton } from '@/components/finance/delete-button';
import { IconButton, Panel, PanelButton, PanelEmpty, PanelNote } from '@/components/finance/panel';
import { SymbolPicker } from '@/components/finance/symbol-picker';
import { api } from '@/lib/api-client';
import { useArrange } from '@/lib/hooks/use-arrange';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { useRowFocus } from '@/lib/hooks/use-row-focus';
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
  const [icon, setIcon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColour, setEditColour] = useState(DEFAULT_COLOUR);
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const { panelRef, ...focus } = useRowFocus(items);
  const arrange = useArrange(items);

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
      () => api.post('/finance/categories', { name, colour, icon }),
      'Could not create that category.'
    );
    if (created) {
      setName('');
      setColour(DEFAULT_COLOUR);
      setIcon(null);
      focus.returnToAction();
      setAdding(false);
    }
  }

  /**
   * Save all three, because a category is its name, its colour *and* its
   * symbol — the colour and symbol are what it looks like everywhere else (the
   * badge on every expense row, the slice in the chart), so each must stay
   * changeable after creation. An explicit null symbol clears it.
   */
  async function handleEdit(id: string) {
    const saved = await run(
      () =>
        api.patch(`/finance/categories/${id}`, {
          name: editName,
          colour: editColour,
          icon: editIcon,
        }),
      'Could not update that category.'
    );
    if (saved) {
      focus.returnToRow(id);
      setEditing(null);
    }
  }

  async function handleDelete(id: string) {
    focus.removing(id);
    const deleted = await run(
      () => api.delete(`/finance/categories/${id}`),
      'Could not delete that category.'
    );
    if (!deleted) focus.cancel();
  }

  /**
   * The order is the categories' everywhere, not only here: every category
   * picker and filter lists them as the server does, so they follow it.
   */
  async function handleSaveOrder() {
    if (!arrange.changed) {
      arrange.stop();
      return;
    }
    const saved = await run(
      () =>
        api.put('/finance/categories/order', {
          ids: arrange.ordered.map((category) => category.id),
        }),
      'Could not save that order.'
    );
    if (saved) arrange.stop();
  }

  return (
    <Panel
      ref={panelRef}
      title="Categories"
      error={error}
      className="h-full"
      action={
        <ArrangeActions
          arranging={arrange.arranging}
          canArrange={items.length > 1 && !adding && editing === null}
          busy={busy}
          noun="categories"
          onStart={arrange.start}
          onCancel={arrange.stop}
          onSave={() => void handleSaveOrder()}
        >
          <PanelButton
            label={adding ? 'Cancel' : 'New category'}
            onClick={() => setAdding((open) => !open)}
          >
            {adding ? 'Cancel' : 'New'}
          </PanelButton>
        </ArrangeActions>
      }
    >
      {adding && (
        <form
          className="space-y-2 border-b border-border bg-surface-muted p-3"
          onSubmit={handleCreate}
        >
          <div>
            <label className="block text-xs text-fg-muted" htmlFor="category-name">
              Name
            </label>
            <input
              id="category-name"
              autoFocus
              className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <SymbolPicker idPrefix="new-category" value={icon} onChange={setIcon} name={name} />
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-fg-muted" htmlFor="category-colour">
                Colour
              </label>
              <input
                id="category-colour"
                className="mt-1 h-8 w-12 rounded-sm border"
                type="color"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              />
            </div>
            {/* What the badge will look like, as the choices are made. */}
            <CategoryBadge colour={colour} name={name || '?'} icon={icon} />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-4"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : items.length === 0 && error ? null : items.length === 0 ? (
        !adding && (
          <PanelEmpty icon={Tags}>
            No categories yet. Create one before setting a budget.
          </PanelEmpty>
        )
      ) : arrange.arranging ? (
        <ArrangeList
          items={arrange.ordered}
          nameOf={(category) => category.name}
          rowClassName={() => 'bg-surface-muted'}
          onMove={arrange.move}
          disabled={busy}
        >
          {(category) => (
            <span className="flex min-w-0 items-center gap-3">
              <CategoryBadge colour={category.colour} name={category.name} icon={category.icon} />
              <p className="truncate text-sm font-medium">{category.name}</p>
            </span>
          )}
        </ArrangeList>
      ) : (
        <ul className="space-y-2 p-3">
          {items.map((category) =>
            editing === category.id ? (
              // The swatch becomes the colour input, so the thing being edited
              // sits where the thing it changes was. Stacked rather than one
              // row: this panel is the narrowest on the page.
              <li
                key={category.id}
                className="space-y-2 rounded-lg border border-border bg-surface-muted px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Colour for ${category.name}`}
                    className="h-7 w-8 shrink-0 rounded-sm border"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                  />
                  <input
                    // Opening the editor replaces the row the focus was in;
                    // this is the field the click was asking for.
                    autoFocus
                    aria-label={`Rename ${category.name}`}
                    className="min-w-0 flex-1 rounded-sm border px-2 py-1 text-sm"
                    value={editName}
                    maxLength={50}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <SymbolPicker
                  idPrefix={`edit-${category.id}`}
                  value={editIcon}
                  onChange={setEditIcon}
                  name={editName}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs underline disabled:opacity-50 inline-flex items-center pointer-coarse:min-h-11 pointer-coarse:px-1.5"
                    onClick={() => void handleEdit(category.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center text-xs text-fg-muted underline pointer-coarse:min-h-11 pointer-coarse:px-1.5"
                    onClick={() => {
                      focus.returnToRow(category.id);
                      setEditing(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={category.id}
                data-row-id={category.id}
                className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5"
              >
                <CategoryBadge colour={category.colour} name={category.name} icon={category.icon} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>

                <IconButton
                  label={`Rename ${category.name}`}
                  icon={Pencil}
                  onClick={() => {
                    setEditing(category.id);
                    setEditName(category.name);
                    setEditColour(category.colour);
                    setEditIcon(category.icon);
                  }}
                />
                <DeleteButton
                  label={`Delete ${category.name}`}
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
