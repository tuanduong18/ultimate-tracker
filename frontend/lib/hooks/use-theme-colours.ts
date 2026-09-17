'use client';

import { useEffect, useState } from 'react';

/**
 * Theme tokens resolved to real colour strings.
 *
 * Charts are the one place Tailwind classes do not reach: recharts draws its
 * grid, axes and bars from props it passes to SVG attributes, so it needs
 * `rgb(45 108 185)` and not `text-primary`. This reads the live values of the
 * CSS variables the theme sets, so the charts recolour with everything else
 * instead of keeping a second copy of the palette in TypeScript.
 */
const TOKENS = ['primary', 'border', 'fg-muted', 'surface-muted'] as const;

type Token = (typeof TOKENS)[number];
export type ThemeColours = Record<Token, string>;

/**
 * Pastel blue, matching the `:root` block in globals.css.
 *
 * Used on the server, before the first effect runs, and anywhere the variables
 * cannot be resolved — jsdom, for one, which loads no stylesheet. The charts
 * then render in the default palette rather than with `undefined` for a fill.
 */
const FALLBACK: ThemeColours = {
  primary: 'rgb(45 108 185)',
  border: 'rgb(213 229 246)',
  'fg-muted': 'rgb(88 114 145)',
  'surface-muted': 'rgb(237 244 253)',
};

function readColours(root: HTMLElement): ThemeColours {
  const styles = getComputedStyle(root);
  const entries = TOKENS.map((name) => {
    const channels = styles.getPropertyValue(`--color-${name}`).trim();
    return [name, channels ? `rgb(${channels})` : FALLBACK[name]];
  });
  return Object.fromEntries(entries) as ThemeColours;
}

export function useThemeColours(): ThemeColours {
  const [colours, setColours] = useState<ThemeColours>(FALLBACK);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setColours(readColours(root));
    sync();

    // Watching the attribute rather than subscribing to ThemeProvider keeps
    // this usable in isolation — a chart rendered in a test has no provider
    // above it, and should still pick a colour rather than throw.
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return colours;
}
