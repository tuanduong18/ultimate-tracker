'use client';

import { useState } from 'react';

import { api } from '@/lib/api-client';
import { describeError, useCollection } from '@/lib/hooks/use-collection';
import type { Category } from '@/lib/types/finance';

const DEFAULT_COLOUR = '#94a3b8';

export function CategorySection() {
  const { items, loading, error, reload, setError } =
    useCollection<Category>('/finance/categories');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [busy, setBusy] = useState(false);
  // Inline rather than window.confirm: deleting a category silently
  // uncategorises its expenses, which is worth spelling out before they click.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
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

  async function handleRename(id: string) {
    const renamed = await run(
      () => api.patch(`/finance/categories/${id}`, { name: editName }),
      'Could not rename that category.'
    );
    if (renamed) setEditing(null);
  }

  async function handleDelete(id: string) {
    await run(() => api.delete(`/finance/categories/${id}`), 'Could not delete that category.');
    setConfirmingDelete(null);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Categories</h2>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => setAdding((open) => !open)}
        >
          {adding ? 'Cancel' : 'New category'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {adding && (
        <form className="mt-3 flex items-end gap-2" onSubmit={handleCreate}>
          <div className="flex-1">
            <label className="block text-sm" htmlFor="category-name">
              Name
            </label>
            <input
              id="category-name"
              className="mt-1 w-full rounded border px-3 py-2"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm" htmlFor="category-colour">
              Colour
            </label>
            <input
              id="category-colour"
              className="mt-1 h-10 w-14 rounded border"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      <div className="mt-3 rounded-lg border border-gray-200">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            No categories yet. Create one before setting a budget.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: category.colour }}
                />

                {editing === category.id ? (
                  <>
                    <input
                      aria-label={`Rename ${category.name}`}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                      value={editName}
                      maxLength={50}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className="text-sm underline disabled:opacity-50"
                      onClick={() => void handleRename(category.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-500 underline"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{category.name}</span>

                    {confirmingDelete === category.id ? (
                      <>
                        <span className="text-sm text-gray-500">
                          Delete? Its expenses become uncategorised.
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          className="text-sm text-red-600 underline disabled:opacity-50"
                          onClick={() => void handleDelete(category.id)}
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          className="text-sm text-gray-500 underline"
                          onClick={() => setConfirmingDelete(null)}
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-sm underline"
                          onClick={() => {
                            setEditing(category.id);
                            setEditName(category.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-sm text-red-600 underline"
                          onClick={() => setConfirmingDelete(category.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
