import { ACCENTS, NEUTRAL } from '@/theme/tokens';

/**
 * The colour schemes and modes on offer, mirroring frontend/lib/theme.ts.
 *
 * Two independent choices, as on the web: a scheme (an accent colour on the shared neutral
 * base) and light or dark. Ids are the web's, so a choice can one day be carried between the
 * two clients; labels and order are the web's too. The colours themselves are generated into
 * tokens.ts — nothing here picks a colour.
 */
export const THEMES = [
  { id: 'pastel-blue', label: 'Blue', blurb: 'Clear and calm. The default.' },
  { id: 'pastel-teal', label: 'Teal', blurb: 'Cool sea-glass blue-green.' },
  { id: 'pastel-mint', label: 'Green', blurb: 'Fresh and steady.' },
  { id: 'pastel-honey', label: 'Amber', blurb: 'Warm gold, like late sun.' },
  { id: 'pastel-peach', label: 'Terracotta', blurb: 'Earthy orange-red.' },
  { id: 'pastel-rose', label: 'Rose', blurb: 'Deep berry pink.' },
  { id: 'pastel-lilac', label: 'Violet', blurb: 'Soft purple with depth.' },
  { id: 'slate', label: 'Graphite', blurb: 'No colour at all — ink on paper.' },
] as const satisfies readonly { id: keyof typeof ACCENTS; label: string; blurb: string }[];

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'pastel-blue';

/**
 * Light, dark, or whatever the phone is set to. `system` is the default because it is the only
 * choice that is right for everyone before they have chosen.
 */
export const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
] as const;

export type ModePreference = (typeof MODES)[number]['id'];
export type ResolvedMode = 'light' | 'dark';

export const DEFAULT_MODE: ModePreference = 'system';

/**
 * Material's scrim: what dims the screen behind a sheet. Black at 32% in light and dark alike —
 * it darkens whatever is behind it rather than being a colour of its own, so it is fixed rather
 * than generated with the tokens.
 */
export const SCRIM = 'rgba(0, 0, 0, 0.32)';

/** Every colour a component may use: the neutral base for the mode plus the scheme's accent. */
export type Colors = {
  [K in keyof typeof NEUTRAL.light | keyof (typeof ACCENTS)['pastel-blue']['light']]: string;
};

/**
 * `system` follows the phone. React Native reports `null` (or `unspecified`) when the phone
 * gives no answer; light is the safe guess there.
 */
export function resolveMode(
  preference: ModePreference,
  systemScheme: string | null | undefined
): ResolvedMode {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function resolveColors(theme: ThemeId, mode: ResolvedMode): Colors {
  return { ...NEUTRAL[mode], ...ACCENTS[theme][mode] };
}
