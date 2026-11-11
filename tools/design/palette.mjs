#!/usr/bin/env node
/**
 * The one source of both clients' colours: the token section of
 * frontend/app/globals.css (between TOKENS:BEGIN and TOKENS:END) and the Android
 * app's mobile/src/theme/tokens.ts.
 *
 *   node tools/design/palette.mjs --write    regenerate both files in place
 *   node tools/design/palette.mjs --check    exit 1 if either is out of date (CI runs this)
 *   node tools/design/palette.mjs            print the CSS section (swatches on stderr)
 *   node tools/design/palette.mjs --ts       print the TypeScript module
 *
 * After --write, run contrast.mjs (must exit 0) and look at the result in both
 * clients. --check also compares the swatches in frontend/lib/theme.ts, which
 * are pasted by hand from the default mode's stderr.
 *
 * The model (2026-10-22 redesign):
 * - **One neutral base per mode**, shared by every scheme: warm greys at almost
 *   no chroma. Surfaces carry no hue, so the colours that *mean* something —
 *   category colours on cards and charts, red for over budget — never compete
 *   with a tinted page.
 * - **A scheme is an accent**: `primary`, `primary-fg`, `primary-soft` only.
 *   That is all a scheme block sets.
 * - Everything is authored in OKLCH (perceptually even lightness, so one recipe
 *   fits every hue) and every foreground is *solved*: lightness stepped until it
 *   clears its contrast target against every surface it can sit on.
 *
 * To add a scheme, add a row to SCHEMES and to THEMES in lib/theme.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CSS_FILE = resolve(ROOT, 'frontend/app/globals.css');
const TS_FILE = resolve(ROOT, 'mobile/src/theme/tokens.ts');
const THEME_FILE = resolve(ROOT, 'frontend/lib/theme.ts');

/** id, OKLCH hue, accent chroma, and the light-mode lightness to start solving from. */
const SCHEMES = [
  { id: 'pastel-blue', h: 255, c: 0.15 },
  { id: 'pastel-mint', h: 155, c: 0.13 },
  { id: 'pastel-teal', h: 200, c: 0.11 },
  { id: 'pastel-lilac', h: 295, c: 0.15 },
  { id: 'pastel-rose', h: 0, c: 0.14 },
  { id: 'pastel-peach', h: 42, c: 0.14 },
  { id: 'pastel-honey', h: 75, c: 0.13 },
  { id: 'slate', h: 265, c: 0.015, startL: 0.3 },
];

/** Warm grey: a hint of yellow keeps neutrals from reading cold and clinical. */
const NEUTRAL_HUE = 70;

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH → 8-bit sRGB, giving up chroma (never lightness) to stay in gamut. */
function rgb(L, C, h) {
  for (let c = C; c >= 0; c -= 0.002) {
    const lin = oklchToLinear(L, c, h);
    if (lin.every((v) => v >= -0.0001 && v <= 1.0001)) {
      return lin.map((v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.max(0, v)))) * 255));
    }
  }
  return oklchToLinear(L, 0, h).map((v) => Math.round(toGamma(Math.max(0, v)) * 255));
}

const lum = ([r, g, b]) => {
  const f = (c) => toLinear(c / 255);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Step L from L0 in `dir` (+1 lighter, -1 darker) until contrast >= min against every bg. */
function solve(L0, C, h, bgs, min, dir) {
  for (let L = L0; L >= 0 && L <= 1; L += 0.005 * dir) {
    const c = rgb(L, C, h);
    if (bgs.every((b) => ratio(c, b) >= min)) return c;
  }
  throw new Error(`cannot solve h=${h} min=${min}`);
}

const WHITE = [255, 255, 255];
const N = NEUTRAL_HUE;

function neutralLight() {
  const t = {};
  t.bg = rgb(0.985, 0.003, N);
  t.surface = WHITE;
  t['surface-muted'] = rgb(0.97, 0.004, N);
  t.border = rgb(0.915, 0.005, N);
  const surfaces = [t.surface, t['surface-muted'], t.bg];
  t['border-control'] = solve(0.75, 0.006, N, surfaces, 3.05, -1);
  t.fg = rgb(0.24, 0.01, N);
  t['fg-muted'] = solve(0.58, 0.01, N, surfaces, 4.6, -1);
  t['fg-subtle'] = rgb(0.74, 0.008, N);
  t.positive = solve(0.55, 0.13, 150, surfaces, 4.6, -1);
  t['negative-soft'] = rgb(0.955, 0.03, 27);
  t.negative = solve(0.55, 0.19, 27, [...surfaces, t['negative-soft']], 4.6, -1);
  t['negative-fg'] = WHITE;
  return t;
}

function neutralDark() {
  const t = {};
  t.bg = rgb(0.19, 0.004, N);
  t['surface-muted'] = rgb(0.215, 0.004, N);
  t.surface = rgb(0.24, 0.005, N);
  t.border = rgb(0.32, 0.006, N);
  const surfaces = [t.surface, t['surface-muted'], t.bg];
  t['border-control'] = solve(0.45, 0.006, N, surfaces, 3.05, +1);
  t.fg = rgb(0.95, 0.004, N);
  t['fg-muted'] = solve(0.7, 0.008, N, surfaces, 4.6, +1);
  t['fg-subtle'] = rgb(0.55, 0.008, N);
  t.positive = solve(0.72, 0.14, 150, surfaces, 4.6, +1);
  t['negative-soft'] = rgb(0.3, 0.07, 27);
  t.negative = solve(0.7, 0.15, 27, [...surfaces, t['negative-soft']], 4.6, +1);
  t['negative-fg'] = solve(0.22, 0.03, 27, [t.negative], 4.6, -1);
  return t;
}

function accentLight({ h, c, startL = 0.58 }, base) {
  const soft = rgb(0.955, Math.min(c, 0.04), h);
  const primary = solve(
    startL,
    c,
    h,
    [base.surface, base.bg, base['surface-muted'], soft],
    4.6,
    -1
  );
  return { primary, 'primary-fg': WHITE, 'primary-soft': soft };
}

function accentDark({ h, c }, base) {
  const soft = rgb(0.31, Math.min(c, 0.06), h);
  const surfaces = [base.surface, base.bg, base['surface-muted'], soft];
  const primary = solve(0.72, Math.min(c, 0.13), h, surfaces, 4.6, +1);
  const fg = solve(0.22, Math.min(c, 0.03), h, [primary], 4.6, -1);
  return { primary, 'primary-fg': fg, 'primary-soft': soft };
}

// Budget cards: told apart by hue alone, fixed across schemes, one set per mode.
const BUDGET_HUES = [255, 15, 150, 300, 55, 200, 95, 345];
// Light enough that fg-muted ("Total paid", the schedule line) and negative
// ("Overshooting") clear 4.5:1 on every one — 0.955 left fg-muted at 4.37.
const budgetLight = BUDGET_HUES.map((h) => rgb(0.968, 0.028, h));
const budgetDark = BUDGET_HUES.map((h) => rgb(0.31, 0.045, h));

const line = (k, v) => `  --channel-${k}: ${v.join(' ')};`;
const lines = (t) =>
  Object.entries(t)
    .map(([k, v]) => line(k, v))
    .join('\n');
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

const light = neutralLight();
const dark = neutralDark();
const defaultAccent = accentLight(SCHEMES[0], light);

/**
 * `--ts`: the same palette as a TypeScript module for the Android app
 * (mobile/src/theme/tokens.ts). React Native has no CSS variables, so the
 * values ship as hex strings, keyed in camelCase; the generator, and so every
 * value, is shared with the web.
 */
function tsModule() {
  const camel = (k) => k.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  const obj = (t, pad) =>
    `{\n${Object.entries(t)
      .map(([k, v]) => `${pad}  ${camel(k)}: '${hex(v)}',`)
      .join('\n')}\n${pad}}`;
  // Quote a key only when it must be quoted, as the app's formatter (Oxfmt) writes it.
  const key = (id) => (/^[A-Za-z_$][\w$]*$/.test(id) ? id : `'${id}'`);
  const accents = SCHEMES.map(
    (s) =>
      `  ${key(s.id)}: {\n    light: ${obj(accentLight(s, light), '    ')},\n    dark: ${obj(accentDark(s, dark), '    ')},\n  },`
  ).join('\n');
  const list = (cs) => `[${cs.map((c) => `'${hex(c)}'`).join(', ')}]`;
  return `// TOKENS — generated by tools/design/palette.mjs; edit the script, not this.

/**
 * The app's colours: the same values as the web's globals.css, from the same
 * generator. A neutral base per mode, shared by every scheme, and an accent per
 * scheme (primary, primaryFg, primarySoft) — see useAppTheme for how they merge.
 */
export const NEUTRAL = {
  light: ${obj(light, '  ')},
  dark: ${obj(dark, '  ')},
} as const;

export const ACCENTS = {
${accents}
} as const;

/** Budget card backgrounds: told apart by hue alone, the same in every scheme. */
export const BUDGET_TINTS = {
  light: ${list(budgetLight)},
  dark: ${list(budgetDark)},
} as const;`;
}

const out = [];
out.push(`/* TOKENS:BEGIN — generated by tools/design/palette.mjs; edit the script, not this. */

/*
 * The neutral base, shared by every scheme. Surfaces are warm greys with no
 * real hue: colour on this app means something — a category, over budget,
 * the thing to press — and a tinted page would compete with all of it.
 * The default scheme's accent rides along here so a missing data-theme still
 * renders a whole palette.
 */
:root {
  color-scheme: light;
${lines(light)}
${lines(defaultAccent)}
${budgetLight.map((v, i) => line(`budget-${i + 1}`, v)).join('\n')}
}

/*
 * Dark mode is a second axis, not another scheme: data-mode sits beside
 * data-theme, so every accent has a dark version. Not an inversion — warm dark
 * greys rather than black (black is harsh and leaves nowhere to go for
 * elevation), raised surfaces lighter rather than shadowed, and accents turned
 * into light tints with dark text on them.
 */
[data-mode='dark'] {
  /* Native controls — date pickers, scrollbars, select menus — follow suit. */
  color-scheme: dark;
${lines(dark)}
${budgetDark.map((v, i) => line(`budget-${i + 1}`, v)).join('\n')}
}

/*
 * Schemes: an accent each, and nothing else. Ids keep their original names so a
 * choice already stored in someone's browser still matches.
 */`);

const swatches = {};
for (const scheme of SCHEMES) {
  const l = accentLight(scheme, light);
  const d = accentDark(scheme, dark);
  out.push(
    `[data-theme='${scheme.id}'] {\n${lines(l)}\n}\n\n[data-theme='${scheme.id}'][data-mode='dark'] {\n${lines(d)}\n}`
  );
  swatches[scheme.id] = {
    light: [hex(l['primary-soft']), hex(l.primary)],
    dark: [hex(d['primary-soft']), hex(d.primary)],
  };
}
out.push('/* TOKENS:END */');
const cssSection = out.join('\n\n');

/** Line endings never count as a difference: a Windows checkout may hold CRLF. */
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const SECTION = /\/\* TOKENS:BEGIN[\s\S]*?\/\* TOKENS:END \*\//;

function cssWithSection(source) {
  if (!SECTION.test(source))
    throw new Error(`${CSS_FILE} has no TOKENS:BEGIN … TOKENS:END section`);
  return source.replace(SECTION, () => cssSection);
}

/** The swatch each scheme shows in Settings, as lib/theme.ts writes it. */
const swatchText = (s) =>
  `{ light: ['${s.light.join("', '")}'], dark: ['${s.dark.join("', '")}'] }`;

function staleSwatches() {
  const theme = read(THEME_FILE);
  return Object.entries(swatches)
    .filter(([id, s]) => {
      const entry = new RegExp(`id: '${id}',[\\s\\S]*?swatch: (\\{[^}]*\\})`).exec(theme);
      return !entry || entry[1] !== swatchText(s);
    })
    .map(([id]) => id);
}

const mode = process.argv.slice(2).find((arg) => arg.startsWith('--'));
if (mode === '--ts') {
  console.log(tsModule());
} else if (mode === '--write') {
  writeFileSync(CSS_FILE, cssWithSection(read(CSS_FILE)));
  writeFileSync(TS_FILE, tsModule() + '\n');
  console.log('Wrote frontend/app/globals.css and mobile/src/theme/tokens.ts.');
  const stale = staleSwatches();
  if (stale.length) {
    console.log(`Now paste these swatches into frontend/lib/theme.ts:`);
    for (const id of stale) console.log(`  ${id}: swatch: ${swatchText(swatches[id])},`);
  }
} else if (mode === '--check') {
  const stale = [];
  const css = read(CSS_FILE);
  if (cssWithSection(css) !== css) stale.push('frontend/app/globals.css (token section)');
  if (read(TS_FILE) !== tsModule() + '\n') stale.push('mobile/src/theme/tokens.ts');
  for (const id of staleSwatches()) stale.push(`frontend/lib/theme.ts (swatch of ${id})`);
  if (stale.length) {
    console.error(`Out of date with tools/design/palette.mjs:\n  ${stale.join('\n  ')}`);
    console.error('Run `node tools/design/palette.mjs --write`; never edit the generated values.');
    process.exit(1);
  }
  console.log('Colour tokens are current in both clients.');
} else if (mode) {
  console.error(`Unknown option ${mode}. Use --write, --check, --ts, or no option.`);
  process.exit(2);
} else {
  console.log(cssSection);
  console.error('// lib/theme.ts swatches');
  for (const [id, s] of Object.entries(swatches)) console.error(id, JSON.stringify(s));
}
