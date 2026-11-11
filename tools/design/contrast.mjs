#!/usr/bin/env node
/**
 * WCAG contrast audit of every scheme × mode in frontend/app/globals.css.
 *
 * Composes each palette from the neutral base for its mode plus the scheme's
 * accent block (as the cascade does), and checks each
 * foreground/background pair the app actually draws. Run after touching a
 * token or adding a theme:
 *
 *   node tools/design/contrast.mjs [path/to/globals.css] [--quiet]
 *
 * Exit code 1 if any pair marked `must` fails, so it can gate a change — CI runs
 * it. The Android app draws the same values (tokens.ts comes from the same
 * generator), so one audit covers both clients. --quiet prints only failures
 * and the summary line.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative to this file, not the working directory, so it runs from anywhere.
const DEFAULT_CSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../frontend/app/globals.css'
);
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const file = resolve(args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_CSS);
const css = readFileSync(file, 'utf8');

/**
 * [foreground, background, minimum ratio, must?, where it is used]
 * 4.5 = body text (1.4.3), 3 = large text / UI component boundaries (1.4.11).
 * `must: false` pairs are reported but do not fail the run — they are known
 * trade-offs recorded in references/accessibility.md.
 */
const PAIRS = [
  ['fg', 'bg', 4.5, true, 'body text on page'],
  ['fg', 'surface', 4.5, true, 'body text on cards'],
  ['fg', 'primary-soft', 4.5, true, 'text on selected / soft chips'],
  ['fg-muted', 'surface', 4.5, true, 'secondary text on cards'],
  ['fg-muted', 'bg', 4.5, true, 'secondary text on page'],
  ['fg-muted', 'surface-muted', 4.5, true, 'labels inside inline forms'],
  ['primary-fg', 'primary', 4.5, true, 'primary button label'],
  ['primary', 'surface', 4.5, true, 'primary-coloured text / links'],
  ['primary', 'primary-soft', 4.5, true, 'badge text, icon badges'],
  ['negative', 'surface', 4.5, true, 'error text on cards'],
  ['negative', 'negative-soft', 4.5, true, 'error banner text'],
  // fg-muted is not usable here: 4.40:1 on negative-soft in light mode.
  ['fg', 'negative-soft', 4.5, true, "an import's problem list and its hint, in the red box"],
  ['negative-fg', 'negative', 4.5, true, '"Yes, delete" label on the filled button'],
  ['positive', 'surface', 4.5, true, 'success text ("Saved.")'],
  ['fg-subtle', 'surface', 4.5, false, 'placeholder-ish text — decorative only'],
  ['border-control', 'surface', 3, true, 'form control boundary (1.4.11)'],
  ['border-control', 'surface-muted', 3, true, 'form control in an inline form strip'],
  ['border', 'surface', 3, false, 'card/panel hairline — decorative divider, not a control'],
];

/** Every `selector { ... }` block's --channel-* triplets, keyed by selector text. */
function parse(source) {
  const out = {};
  const re = /([^{}]*?)\{([^{}]*--channel-[^{}]*)\}/g;
  let match;
  while ((match = re.exec(source))) {
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const tokens = {};
    for (const t of match[2].matchAll(/--channel-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
      tokens[t[1]] = [Number(t[2]), Number(t[3]), Number(t[4])];
    }
    out[selector] = { ...(out[selector] ?? {}), ...tokens };
  }
  return out;
}

/**
 * Compose each palette the way the cascade does: the mode's neutral base
 * (`:root`, then `[data-mode='dark']` on top for dark) under the scheme's
 * accent block. Older layouts with a full block per scheme compose the same way.
 */
function palettes(source) {
  const blocks = parse(source);
  const light = blocks[':root'] ?? {};
  const dark = { ...light, ...(blocks["[data-mode='dark']"] ?? {}) };
  const result = {};
  for (const [selector, tokens] of Object.entries(blocks)) {
    const id = /data-theme='([^']+)'/.exec(selector)?.[1];
    if (!id) continue;
    if (selector.includes("data-mode='dark'")) result[`${id}/dark`] = { ...dark, ...tokens };
    else result[id] = { ...light, ...tokens };
  }
  return { result, light, dark };
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const { result: themes, light, dark } = palettes(css);
let failed = false;
let checked = 0;
let warned = 0;

for (const [theme, tokens] of Object.entries(themes)) {
  const lines = [];
  for (const [fg, bg, min, must, use] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const r = ratio(tokens[fg], tokens[bg]);
    const ok = r >= min;
    if (!ok && must) failed = true;
    checked += 1;
    const mark = ok ? 'pass' : must ? 'FAIL' : 'warn';
    if (mark === 'warn') warned += 1;
    if (quiet && mark !== 'FAIL') continue;
    lines.push(`  ${mark}  ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  (needs ${min}) — ${use}`);
  }
  if (lines.length) console.log(['', theme, ...lines].join('\n'));
}

// Budget tints are mode-wide: check each against that mode's fg.
for (const [mode, base] of [
  ['light', light],
  ['dark', dark],
]) {
  const tints = Object.keys(base).filter((k) => k.startsWith('budget-'));
  if (!tints.length || !base.fg) continue;
  // Every text colour a budget card puts on its tint, not just the main one.
  const inks = ['fg', 'fg-muted', 'negative', 'positive'].filter((ink) => base[ink]);
  const worst = Math.min(...tints.flatMap((k) => inks.map((ink) => ratio(base[ink], base[k]))));
  const ok = worst >= 4.5;
  if (!ok) failed = true;
  checked += 1;
  if (quiet && ok) continue;
  console.log(`
budget tints (${mode})
  ${ok ? 'pass' : 'FAIL'}  ${worst.toFixed(2)}:1  worst text colour on any tint (needs 4.5)`);
}
if (checked === 0) {
  // An empty audit must not pass: it means the token section could not be read.
  console.error(`No colour tokens found in ${file}.`);
  process.exit(1);
}
const verdict = failed ? 'FAILED' : 'Passed';
const tradeOffs = warned ? ` ${warned} known trade-offs (marked warn) do not fail the run.` : '';
console.log(
  `\n${verdict}: ${checked} pairs across ${Object.keys(themes).length} palettes.${tradeOffs}`
);
process.exit(failed ? 1 : 0);
