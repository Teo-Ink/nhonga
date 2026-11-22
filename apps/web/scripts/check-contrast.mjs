#!/usr/bin/env node
// WCAG 2.2 AA check for the design tokens, light and dark.
//   node scripts/check-contrast.mjs        (exit 1 on any failure)
// Text needs 4.5:1; UI parts (field borders, focus ring, icons) need 3:1.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'tokens.css'),
  'utf8',
);

function vars(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('/* ── Dark mode'));
const darkA = css.slice(
  css.indexOf(":root[data-theme='dark'] {"),
  css.indexOf('@media (prefers-color-scheme: dark)'),
);
const darkB = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const light = vars(rootBlock);
const dark = { ...light, ...vars(darkA) };

const a = JSON.stringify(vars(darkA));
const b = JSON.stringify(vars(darkB));
let failures = a === b ? 0 : 1;
if (a !== b) console.log('FAIL  the two dark-mode blocks differ');

function resolve(map, v, depth = 0) {
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(v ?? '');
  if (!m) return v;
  if (depth > 10) throw new Error(`var cycle at ${v}`);
  return resolve(map, map[m[1]], depth + 1);
}
function lum(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, bl] = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
function ratio(x, y) {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, what]
const PAIRS = [
  ['text', 'bg', 4.5, 'body text'],
  ['text', 'surface', 4.5, 'body text on cards'],
  ['text', 'surface-sunken', 4.5, 'text on sunken panels'],
  ['text-muted', 'bg', 4.5, 'secondary text'],
  ['text-muted', 'surface', 4.5, 'secondary text on cards'],
  ['text-muted', 'surface-sunken', 4.5, 'secondary text on sunken panels'],
  ['brand', 'bg', 4.5, 'brand text / links'],
  ['brand', 'surface', 4.5, 'brand text on cards'],
  ['brand', 'brand-subtle', 4.5, 'brand text on brand tint'],
  ['link', 'surface', 4.5, 'links'],
  ['on-brand', 'brand-solid', 4.5, 'text on brand buttons'],
  ['on-brand', 'brand-solid-hover', 4.5, 'text on brand buttons (hover)'],
  ['header-text', 'header-bg', 4.5, 'header'],
  ['cta-text', 'cta', 4.5, 'main call to action'],
  ['cta-text', 'cta-hover', 4.5, 'main call to action (hover)'],
  ['success', 'success-bg', 4.5, 'success message'],
  ['warning', 'warning-bg', 4.5, 'warning message'],
  ['danger', 'danger-bg', 4.5, 'error message'],
  ['danger', 'surface', 4.5, 'inline field error'],
  ['info', 'info-bg', 4.5, 'info message'],
  ['on-danger', 'danger-solid', 4.5, 'destructive button'],
  ['rating-text', 'surface', 4.5, 'rating number'],
  ['border-input', 'surface', 3, 'form field border'],
  ['border-input', 'bg', 3, 'form field border on page'],
  ['focus-ring', 'surface', 3, 'focus ring'],
  ['focus-ring', 'bg', 3, 'focus ring on page'],
  ['rating', 'surface', 3, 'rating stars'],
  ['brand-solid', 'surface', 3, 'brand fill edge (badges, toggles)'],
];

for (const [theme, map] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [fg, bg, min, what] of PAIRS) {
    const f = resolve(map, map[fg]);
    const g = resolve(map, map[bg]);
    if (!/^#[0-9a-f]{6}$/i.test(f ?? '') || !/^#[0-9a-f]{6}$/i.test(g ?? '')) {
      console.log(`SKIP  ${theme.padEnd(5)} ${fg} on ${bg} (not a solid colour)`);
      continue;
    }
    const r = ratio(f, g);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'}  ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1 ≥ ${min}  ${what}  (${fg} ${f} on ${bg} ${g})`,
    );
  }
}
console.log(failures ? `\n${failures} failure(s)` : '\nAll pairs meet WCAG 2.2 AA.');
process.exit(failures ? 1 : 0);
