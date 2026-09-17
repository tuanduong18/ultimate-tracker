'use client';

import { useTheme } from '@/components/shared/theme-provider';
import { THEMES } from '@/lib/theme';

/**
 * Pick the app's colour scheme.
 *
 * A radio group rather than a dropdown: there are five of them, each is a
 * colour, and a list of swatches you can see at once is the point. Applying is
 * immediate with no Save button — the whole page recolours under the cursor,
 * which is a better preview than any swatch, and there is nothing to lose by
 * changing your mind.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset>
      <legend className="text-sm font-medium">Colour scheme</legend>
      <p className="mt-1 text-sm text-fg-muted">
        Applies straight away, and is remembered on this device.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selected
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="theme"
                className="sr-only"
                value={option.id}
                checked={selected}
                onChange={() => setTheme(option.id)}
              />

              <span aria-hidden className="mt-0.5 flex shrink-0 gap-1">
                {option.swatch.map((colour) => (
                  <span
                    key={colour}
                    className="h-5 w-5 rounded-full border border-border"
                    style={{ backgroundColor: colour }}
                  />
                ))}
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-fg-muted">{option.blurb}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
