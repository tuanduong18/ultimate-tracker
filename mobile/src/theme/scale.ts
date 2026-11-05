import type { TextStyle } from 'react-native';

/**
 * Type, spacing and shape for the app — the phone's version of the web's scale in the UX/UI
 * design notes, in density-independent pixels.
 *
 * Type is the system font (Roboto on Android): native, already on the phone, so nothing has to
 * load before the first frame, and it has tabular figures for columns of money. Sizes sit a
 * step above the web's 14px body because a phone is read at arm's length and in motion.
 */
export const TYPE = {
  /** A screen's own title, when the header does not carry it. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  /** A card or section heading. */
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  /** Secondary lines, captions, meta. The floor: nothing smaller than 12. */
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Small labels on chips and pills. */
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof TYPE;

/** Spacing steps (dp). Screens pad 16; cards pad 20. */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 } as const;

/** Radii, matching the web: cards 16 (rounded-2xl), controls and rows 8, pills full. */
export const RADIUS = { control: 8, card: 16, pill: 999 } as const;

/** Android's minimum touch target. Every tappable thing is at least this tall and wide. */
export const TOUCH_TARGET = 48;
