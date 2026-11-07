import { Check } from 'lucide-react';

import { initialOf } from '@/components/finance/category-badge';
import { CATEGORY_SYMBOLS } from '@/lib/category-symbols';

/**
 * Pick a category's symbol from the shared list — or none, which keeps the
 * initial. One grid of small tiles, the first of them "None", rather than a
 * dropdown: the options are pictures, and seeing them all at once is the point.
 *
 * Real radio inputs, visually hidden inside each tile (the ThemePicker's
 * pattern): the group is one Tab stop, arrow keys move through it, and screen
 * readers announce each symbol by name and as checked or not. Because the input
 * is hidden, the tile draws the keyboard focus ring itself, and the chosen tile
 * is marked by a tick as well as its tint — a tint alone is lost on anyone who
 * can't tell it apart from the surface.
 *
 * Tiles are 36px (44px on touch), with the symbol's name as a tooltip.
 */
export function SymbolPicker({
  idPrefix,
  value,
  onChange,
  name,
}: {
  /** Unique per rendered picker: two groups sharing a radio name merge into one. */
  idPrefix: string;
  value: string | null;
  onChange: (key: string | null) => void;
  /** The category's name, for the "None" tile's preview of its initial. */
  name: string;
}) {
  const options = [
    { key: null, label: 'No symbol — show the initial', content: initialOf(name || '?') },
    ...CATEGORY_SYMBOLS.map((symbol) => ({
      key: symbol.key,
      label: symbol.label,
      content: <symbol.Icon aria-hidden className="size-4" />,
    })),
  ];

  return (
    <fieldset>
      <legend className="block text-xs text-fg-muted">Symbol</legend>
      <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <label
              key={option.key ?? 'none'}
              title={option.label}
              className={`relative flex size-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary pointer-coarse:size-11 ${
                selected
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-symbol`}
                className="sr-only"
                aria-label={option.label}
                checked={selected}
                onChange={() => onChange(option.key)}
              />
              {option.content}
              {selected && (
                <Check
                  aria-hidden
                  className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary p-0.5 text-primary-fg"
                  strokeWidth={3}
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
