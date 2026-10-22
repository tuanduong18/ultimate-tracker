'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/components/shared/theme-provider';
import { MODES, THEMES, type ModePreference } from '@/lib/theme';

const MODE_ICONS: Record<ModePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * One choice in either group: a card wrapping a visually hidden radio.
 *
 * The real radio is visually hidden, so the card has to stand in for it twice
 * over: it draws the keyboard focus ring the hidden input cannot show, and it
 * marks the chosen option with a tick as well as a tint — a tint alone is lost
 * on anyone who cannot tell the two pastels apart.
 */
function Choice({
  name,
  selected,
  onSelect,
  children,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-surface hover:bg-surface-muted'
      }`}
    >
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      {children}
      {selected && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />}
    </label>
  );
}

/**
 * Pick the app's appearance: light or dark, and a colour scheme.
 *
 * Two separate questions rather than one long list of "blue", "blue dark",
 * "mint", "mint dark"… — people decide them for different reasons (the room
 * they are in, the colour they like), and every scheme has both halves.
 *
 * Radio groups rather than dropdowns: the options are colours, and a list of
 * swatches you can see at once is the point. Applying is immediate with no
 * Save button — the whole page recolours under the cursor, which is a better
 * preview than any swatch, and there is nothing to lose by changing your mind.
 * Swatches show the scheme in the mode currently on screen, so what you pick is
 * what you get.
 */
export function ThemePicker() {
  const { theme, setTheme, mode, setMode, resolvedMode } = useTheme();

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-medium">Appearance</legend>
        <p className="mt-1 text-sm text-fg-muted">
          Match system follows your device’s light or dark setting, and changes when it does.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {MODES.map((option) => {
            const Icon = MODE_ICONS[option.id];
            return (
              <Choice
                key={option.id}
                name="mode"
                selected={mode === option.id}
                onSelect={() => setMode(option.id)}
              >
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <span className="min-w-0 flex-1 text-sm font-medium">{option.label}</span>
              </Choice>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Colour scheme</legend>
        <p className="mt-1 text-sm text-fg-muted">
          Applies straight away, and is remembered on this device. Every scheme has a light and a
          dark version.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map((option) => (
            <Choice
              key={option.id}
              name="theme"
              selected={theme === option.id}
              onSelect={() => setTheme(option.id)}
            >
              <span aria-hidden className="mt-0.5 flex shrink-0 gap-1">
                {option.swatch[resolvedMode].map((colour) => (
                  <span
                    key={colour}
                    className="h-5 w-5 rounded-full border border-border"
                    style={{ backgroundColor: colour }}
                  />
                ))}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-fg-muted">{option.blurb}</span>
              </span>
            </Choice>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
