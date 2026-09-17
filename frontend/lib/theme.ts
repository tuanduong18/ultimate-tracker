/**
 * The themes on offer, and how the choice is stored.
 *
 * The palettes themselves live in app/globals.css, keyed by `data-theme` on the
 * document element — so switching is one attribute write and the browser
 * repaints, rather than React re-rendering every styled component. What is here
 * is only what code needs to reason about: which ids exist and how to label them.
 */

export const THEMES = [
  {
    id: 'pastel-blue',
    label: 'Pastel blue',
    blurb: 'Soft blues on near-white. The default.',
    swatch: ['#dbe9fa', '#2d6cb9'],
  },
  {
    id: 'pastel-mint',
    label: 'Pastel mint',
    blurb: 'Cool greens, easiest on the eyes in daylight.',
    swatch: ['#d6f2e7', '#187a58'],
  },
  {
    id: 'pastel-lilac',
    label: 'Pastel lilac',
    blurb: 'Muted violets with a warmer grey.',
    swatch: ['#e9e0fc', '#704cb6'],
  },
  {
    id: 'pastel-peach',
    label: 'Pastel peach',
    blurb: 'Warm terracotta, the only warm palette here.',
    swatch: ['#fde7da', '#ba5728'],
  },
  {
    id: 'slate',
    label: 'Classic slate',
    blurb: 'The original black and grey scheme.',
    swatch: ['#f3f4f6', '#111827'],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'pastel-blue';

/** Namespaced so it cannot collide with anything else on the origin. */
export const THEME_STORAGE_KEY = 'ultimate-tracker:theme';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

/**
 * Read the stored choice, falling back to the default.
 *
 * Storage can throw outright — Safari in private mode, or a browser set to
 * block site data — so this never assumes the read will work. A theme is not
 * worth breaking a page render over.
 */
export function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still applies for this session; it just will not be remembered.
  }
}
