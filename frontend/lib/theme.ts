/**
 * The themes on offer, and how the choice is stored.
 *
 * Two independent choices: a colour scheme (`data-theme`) and light or dark
 * (`data-mode`). The palettes themselves live in app/globals.css, keyed by those
 * attributes on the document element — so switching is an attribute write and
 * the browser repaints, rather than React re-rendering every styled component.
 * What is here is only what code needs to reason about: which ids exist, how to
 * label them, and how the choice is remembered.
 */

/**
 * A scheme is an accent colour on a shared neutral base — buttons, links,
 * focus, selection. Ids keep the names of the original pastel themes so a
 * choice already stored in someone's browser still matches; only the labels
 * moved on. Ordered round the colour wheel, with the neutral last.
 */
export const THEMES = [
  {
    id: 'pastel-blue',
    label: 'Blue',
    blurb: 'Clear and calm. The default.',
    swatch: { light: ['#e7f1fe', '#226bc0'], dark: ['#1a314e', '#6aa7f4'] },
  },
  {
    id: 'pastel-teal',
    label: 'Teal',
    blurb: 'Cool sea-glass blue-green.',
    swatch: { light: ['#d2f9fb', '#06797e'], dark: ['#01383b', '#35b9c0'] },
  },
  {
    id: 'pastel-mint',
    label: 'Green',
    blurb: 'Fresh and steady.',
    swatch: { light: ['#dcf9e5', '#047c46'], dark: ['#123923', '#57bc80'] },
  },
  {
    id: 'pastel-honey',
    label: 'Amber',
    blurb: 'Warm gold, like late sun.',
    swatch: { light: ['#ffedd6', '#926203'], dark: ['#422b06', '#d49838'] },
  },
  {
    id: 'pastel-peach',
    label: 'Terracotta',
    blurb: 'Earthy orange-red.',
    swatch: { light: ['#feece5', '#b14e24'], dark: ['#492517', '#e88761'] },
  },
  {
    id: 'pastel-rose',
    label: 'Rose',
    blurb: 'Deep berry pink.',
    swatch: { light: ['#ffeaef', '#ae476d'], dark: ['#48222f', '#e680a1'] },
  },
  {
    id: 'pastel-lilac',
    label: 'Violet',
    blurb: 'Soft purple with depth.',
    swatch: { light: ['#f1eefe', '#785abd'], dark: ['#332a4b', '#ab93ed'] },
  },
  {
    id: 'slate',
    label: 'Graphite',
    blurb: 'No colour at all — ink on paper.',
    swatch: { light: ['#ebf0fb', '#2a2e36'], dark: ['#2d3038', '#a0a5ae'] },
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

/**
 * Light, dark, or whatever the operating system is set to.
 *
 * `system` is the default because it is the only choice that is right for
 * everyone before they have chosen: someone whose whole desktop is dark should
 * not be met by a white page at midnight.
 */
export const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
] as const;

export type ModePreference = (typeof MODES)[number]['id'];

/** What `system` turns into — the only two values `data-mode` ever holds. */
export type ResolvedMode = 'light' | 'dark';

export const DEFAULT_MODE: ModePreference = 'system';

export const MODE_STORAGE_KEY = 'ultimate-tracker:mode';

/** The media query the OS setting is read through, shared with ThemeScript. */
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isModePreference(value: unknown): value is ModePreference {
  return MODES.some((mode) => mode.id === value);
}

export function readStoredMode(): ModePreference {
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isModePreference(stored) ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function storeMode(mode: ModePreference): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Applies for this session; it just will not be remembered.
  }
}

/** Turn a preference into the mode to paint, asking the OS when told to. */
export function resolveMode(mode: ModePreference): ResolvedMode {
  if (mode !== 'system') return mode;
  // matchMedia is missing in some test environments; light is the safe guess.
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}
