#!/usr/bin/env node
/*
 * Self-contained Tailwind CSS build.
 *
 * The usual toolchain (`npm i tailwindcss` / the Play CDN) is unreachable in
 * this environment because the egress policy blocks the npm registry and every
 * public CDN. To still get the Tailwind authoring experience -- utility classes
 * in the markup, a configurable theme, a single compiled stylesheet -- this
 * script generates `dist/tailwind.css` from the standard Tailwind scale and
 * palette using only Node's stdlib. No network, no dependencies.
 *
 * Theme values live in `tailwind.config.js`. Run `npm run build:css` to rebuild.
 */

'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../tailwind.config.js');

const { colors, spacing, radius, fontSize, shadow, screens } = config.theme;

/* ------------------------------------------------------------------ helpers */
const rules = [];
const add = (selector, decls) => rules.push({ selector, decls });

// Escape a class name so it can be used as a CSS selector
// e.g. "hover:bg-blue-500" -> ".hover\:bg-blue-500:hover"
const esc = (name) => name.replace(/[:./]/g, (c) => '\\' + c);

const declString = (decls) =>
  Object.entries(decls)
    .map(([p, v]) => `  ${p}: ${v};`)
    .join('\n');

// Register a utility for the base state plus interaction / responsive variants.
const variants = {
  hover: (s) => `${s}:hover`,
  focus: (s) => `${s}:focus`,
  active: (s) => `${s}:active`,
  disabled: (s) => `${s}:disabled`,
};

function util(name, decls, opts = {}) {
  add('.' + esc(name), decls);
  const withVariants = opts.variants || [];
  for (const v of withVariants) {
    const vname = `${v}:${name}`;
    add(variants[v]('.' + esc(vname)), decls);
  }
}

/* Responsive: collect utilities that should also exist under breakpoints. */
const responsiveBuckets = Object.fromEntries(
  Object.keys(screens).map((k) => [k, []])
);
function responsiveUtil(name, decls) {
  util(name, decls);
  for (const bp of Object.keys(screens)) {
    responsiveBuckets[bp].push({ selector: '.' + esc(`${bp}:${name}`), decls });
  }
}

/* ---------------------------------------------------------------- preflight */
const preflight = `/* preflight */
*,*::before,*::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:currentColor}
*{margin:0;padding:0}
html{-webkit-text-size-adjust:100%;line-height:1.5;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
body{min-height:100vh;line-height:inherit}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
a{color:inherit;text-decoration:inherit}
img,svg,video,canvas{display:block;max-width:100%;height:auto}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;background:none}
ul,ol{list-style:none}
:root{color-scheme:light dark}`;

/* ------------------------------------------------------------------ colors */
// bg / text / border / ring for the whole palette
for (const [name, shades] of Object.entries(colors)) {
  if (typeof shades === 'string') {
    util(`bg-${name}`, { 'background-color': shades }, { variants: ['hover', 'focus'] });
    util(`text-${name}`, { color: shades }, { variants: ['hover'] });
    util(`border-${name}`, { 'border-color': shades }, { variants: ['hover', 'focus'] });
    continue;
  }
  for (const [shade, hex] of Object.entries(shades)) {
    util(`bg-${name}-${shade}`, { 'background-color': hex }, { variants: ['hover', 'focus'] });
    util(`text-${name}-${shade}`, { color: hex }, { variants: ['hover', 'focus'] });
    util(`border-${name}-${shade}`, { 'border-color': hex }, { variants: ['hover', 'focus'] });
    util(`ring-${name}-${shade}`, { '--tw-ring-color': hex }, { variants: ['focus'] });
    util(`from-${name}-${shade}`, { '--tw-gradient-from': hex, '--tw-gradient-stops': `var(--tw-gradient-from), var(--tw-gradient-to, rgba(0,0,0,0))` });
    util(`to-${name}-${shade}`, { '--tw-gradient-to': hex });
    util(`via-${name}-${shade}`, { '--tw-gradient-stops': `var(--tw-gradient-from), ${hex}, var(--tw-gradient-to, rgba(0,0,0,0))` });
  }
}

/* ------------------------------------------------------------- spacing/size */
const sides = {
  '': ['margin'], t: ['margin-top'], r: ['margin-right'], b: ['margin-bottom'],
  l: ['margin-left'], x: ['margin-left', 'margin-right'], y: ['margin-top', 'margin-bottom'],
};
for (const [key, val] of Object.entries(spacing)) {
  const v = val;
  // padding
  responsiveUtil(`p-${key}`, { padding: v });
  responsiveUtil(`px-${key}`, { 'padding-left': v, 'padding-right': v });
  responsiveUtil(`py-${key}`, { 'padding-top': v, 'padding-bottom': v });
  responsiveUtil(`pt-${key}`, { 'padding-top': v });
  responsiveUtil(`pr-${key}`, { 'padding-right': v });
  responsiveUtil(`pb-${key}`, { 'padding-bottom': v });
  responsiveUtil(`pl-${key}`, { 'padding-left': v });
  // margin (+ negative)
  for (const [sfx, props] of Object.entries(sides)) {
    const cls = `m${sfx}-${key}`;
    const decls = Object.fromEntries(props.map((p) => [p, v]));
    responsiveUtil(cls, decls);
    if (val !== '0px' && /^[0-9.]+/.test(val)) {
      const neg = Object.fromEntries(props.map((p) => [p, `-${v}`]));
      responsiveUtil(`-${cls}`, neg);
    }
  }
  // gap
  responsiveUtil(`gap-${key}`, { gap: v });
  responsiveUtil(`gap-x-${key}`, { 'column-gap': v });
  responsiveUtil(`gap-y-${key}`, { 'row-gap': v });
  // width / height (spacing-based)
  responsiveUtil(`w-${key}`, { width: v });
  responsiveUtil(`h-${key}`, { height: v });
  responsiveUtil(`min-w-${key}`, { 'min-width': v });
  responsiveUtil(`min-h-${key}`, { 'min-height': v });
  // inset
  responsiveUtil(`top-${key}`, { top: v });
  responsiveUtil(`right-${key}`, { right: v });
  responsiveUtil(`bottom-${key}`, { bottom: v });
  responsiveUtil(`left-${key}`, { left: v });
}

/* fractional + keyword sizes */
const fractions = {
  '1/2': '50%', '1/3': '33.333333%', '2/3': '66.666667%', '1/4': '25%',
  '3/4': '75%', '1/5': '20%', '2/5': '40%', '3/5': '60%', '4/5': '80%',
  full: '100%', screen: '100vw', auto: 'auto', min: 'min-content',
  max: 'max-content', fit: 'fit-content',
};
for (const [k, v] of Object.entries(fractions)) {
  responsiveUtil(`w-${k}`, { width: k === 'screen' ? '100vw' : v });
  responsiveUtil(`max-w-${k}`, { 'max-width': v });
}
const heightKeywords = { full: '100%', screen: '100vh', auto: 'auto', min: 'min-content', max: 'max-content', fit: 'fit-content' };
for (const [k, v] of Object.entries(heightKeywords)) {
  responsiveUtil(`h-${k}`, { height: v });
  responsiveUtil(`max-h-${k}`, { 'max-height': v });
  responsiveUtil(`min-h-${k}`, { 'min-height': v });
}
const maxWScreens = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px', '3xl': '1600px', '4xl': '1800px', prose: '65ch', none: 'none' };
for (const [k, v] of Object.entries(maxWScreens)) responsiveUtil(`max-w-${k}`, { 'max-width': v });

/* ------------------------------------------------------------ inset extras */
util('inset-0', { top: '0', right: '0', bottom: '0', left: '0' });
util('inset-x-0', { left: '0', right: '0' });
util('inset-y-0', { top: '0', bottom: '0' });

/* --------------------------------------------------------------- typography */
for (const [k, [size, lh]] of Object.entries(fontSize)) {
  responsiveUtil(`text-${k}`, { 'font-size': size, 'line-height': lh });
}
const fontWeights = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
for (const [k, v] of Object.entries(fontWeights)) util(`font-${k}`, { 'font-weight': String(v) });
const tracking = { tighter: '-0.05em', tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em', widest: '0.1em' };
for (const [k, v] of Object.entries(tracking)) util(`tracking-${k}`, { 'letter-spacing': v });
const leading = { none: '1', tight: '1.25', snug: '1.375', normal: '1.5', relaxed: '1.625', loose: '2' };
for (const [k, v] of Object.entries(leading)) util(`leading-${k}`, { 'line-height': v });
util('italic', { 'font-style': 'italic' });
util('not-italic', { 'font-style': 'normal' });
util('uppercase', { 'text-transform': 'uppercase' });
util('lowercase', { 'text-transform': 'lowercase' });
util('capitalize', { 'text-transform': 'capitalize' });
util('underline', { 'text-decoration-line': 'underline' });
util('no-underline', { 'text-decoration-line': 'none' });
util('line-through', { 'text-decoration-line': 'line-through' });
for (const a of ['left', 'center', 'right', 'justify']) responsiveUtil(`text-${a}`, { 'text-align': a });
util('truncate', { overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' });
util('whitespace-nowrap', { 'white-space': 'nowrap' });
util('break-words', { 'overflow-wrap': 'break-word' });
util('tabular-nums', { 'font-variant-numeric': 'tabular-nums' });
util('select-none', { 'user-select': 'none' });
util('select-text', { 'user-select': 'text' });
util('font-mono', { 'font-family': 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace' });
util('font-sans', { 'font-family': 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' });
util('antialiased', { '-webkit-font-smoothing': 'antialiased', '-moz-osx-font-smoothing': 'grayscale' });

/* ------------------------------------------------------------------ layout */
for (const d of ['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'table', 'hidden']) {
  responsiveUtil(d, { display: d === 'hidden' ? 'none' : d });
}
for (const p of ['static', 'fixed', 'absolute', 'relative', 'sticky']) util(p, { position: p });
util('flex-row', { 'flex-direction': 'row' });
util('flex-col', { 'flex-direction': 'column' });
responsiveUtil('flex-row', { 'flex-direction': 'row' });
responsiveUtil('flex-col', { 'flex-direction': 'column' });
util('flex-wrap', { 'flex-wrap': 'wrap' });
util('flex-nowrap', { 'flex-wrap': 'nowrap' });
util('flex-1', { flex: '1 1 0%' });
util('flex-auto', { flex: '1 1 auto' });
util('flex-none', { flex: 'none' });
util('flex-shrink-0', { 'flex-shrink': '0' });
util('shrink-0', { 'flex-shrink': '0' });
util('grow', { 'flex-grow': '1' });
util('grow-0', { 'flex-grow': '0' });
for (const [k, v] of Object.entries({ start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly' })) {
  responsiveUtil(`justify-${k}`, { 'justify-content': v });
}
for (const [k, v] of Object.entries({ start: 'flex-start', end: 'flex-end', center: 'center', baseline: 'baseline', stretch: 'stretch' })) {
  responsiveUtil(`items-${k}`, { 'align-items': v });
}
for (const [k, v] of Object.entries({ start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch' })) {
  util(`self-${k}`, { 'align-self': v });
}
for (let i = 1; i <= 6; i++) responsiveUtil(`grid-cols-${i}`, { 'grid-template-columns': `repeat(${i}, minmax(0, 1fr))` });
util('grid-cols-none', { 'grid-template-columns': 'none' });
for (let i = 1; i <= 4; i++) util(`col-span-${i}`, { 'grid-column': `span ${i} / span ${i}` });

/* --------------------------------------------------------------- overflow */
for (const v of ['auto', 'hidden', 'visible', 'scroll']) {
  util(`overflow-${v}`, { overflow: v });
  util(`overflow-x-${v}`, { 'overflow-x': v });
  util(`overflow-y-${v}`, { 'overflow-y': v });
}

/* ----------------------------------------------------------- border/radius */
for (const [k, v] of Object.entries(radius)) {
  const cls = k === 'DEFAULT' ? 'rounded' : `rounded-${k}`;
  util(cls, { 'border-radius': v });
  util(`${cls}-t`.replace('rounded-t', k === 'DEFAULT' ? 'rounded-t' : `rounded-t-${k}`), { 'border-top-left-radius': v, 'border-top-right-radius': v });
  util(`${cls}-b`.replace('rounded-b', k === 'DEFAULT' ? 'rounded-b' : `rounded-b-${k}`), { 'border-bottom-left-radius': v, 'border-bottom-right-radius': v });
}
for (const [k, v] of Object.entries({ 0: '0px', DEFAULT: '1px', 2: '2px', 4: '4px', 8: '8px' })) {
  const suf = k === 'DEFAULT' ? '' : `-${k}`;
  util(`border${suf}`, { 'border-width': v });
  util(`border-t${suf}`, { 'border-top-width': v });
  util(`border-b${suf}`, { 'border-bottom-width': v });
  util(`border-l${suf}`, { 'border-left-width': v });
  util(`border-r${suf}`, { 'border-right-width': v });
  util(`border-x${suf}`, { 'border-left-width': v, 'border-right-width': v });
  util(`border-y${suf}`, { 'border-top-width': v, 'border-bottom-width': v });
}

/* ------------------------------------------------------------------ shadow */
for (const [k, v] of Object.entries(shadow)) {
  const cls = k === 'DEFAULT' ? 'shadow' : `shadow-${k}`;
  util(cls, { 'box-shadow': v }, { variants: ['hover'] });
}

/* -------------------------------------------------------- ring / outline */
util('ring-1', { 'box-shadow': '0 0 0 1px var(--tw-ring-color, rgba(59,130,246,0.5))' });
util('ring-2', { 'box-shadow': '0 0 0 2px var(--tw-ring-color, rgba(59,130,246,0.5))' }, { variants: ['focus'] });
util('ring', { 'box-shadow': '0 0 0 3px var(--tw-ring-color, rgba(59,130,246,0.5))' }, { variants: ['focus'] });
util('outline-none', { outline: '2px solid transparent', 'outline-offset': '2px' });
util('ring-inset', { '--tw-ring-inset': 'inset' });

/* ------------------------------------------------------------------ misc */
for (const [k, v] of Object.entries({ 0: '0', 5: '0.05', 10: '0.1', 20: '0.2', 25: '0.25', 30: '0.3', 40: '0.4', 50: '0.5', 60: '0.6', 70: '0.7', 75: '0.75', 80: '0.8', 90: '0.9', 95: '0.95', 100: '1' })) {
  util(`opacity-${k}`, { opacity: v }, { variants: ['hover'] });
}
for (const [k, v] of Object.entries({ auto: 'auto', 0: '0', 10: '10', 20: '20', 30: '30', 40: '40', 50: '50' })) {
  util(`z-${k}`, { 'z-index': v });
}
for (const v of ['auto', 'default', 'pointer', 'wait', 'text', 'move', 'not-allowed', 'grab', 'grabbing', 'crosshair', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize', 'col-resize', 'row-resize']) {
  util(`cursor-${v}`, { cursor: v });
}
for (const v of ['none', 'auto']) util(`pointer-events-${v}`, { 'pointer-events': v });
util('transition', { 'transition-property': 'color,background-color,border-color,fill,stroke,opacity,box-shadow,transform,filter', 'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)', 'transition-duration': '150ms' });
util('transition-colors', { 'transition-property': 'color,background-color,border-color,fill,stroke', 'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)', 'transition-duration': '150ms' });
util('transition-transform', { 'transition-property': 'transform', 'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)', 'transition-duration': '150ms' });
util('transition-all', { 'transition-property': 'all', 'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)', 'transition-duration': '150ms' });
for (const [k, v] of Object.entries({ 75: '75ms', 100: '100ms', 150: '150ms', 200: '200ms', 300: '300ms', 500: '500ms' })) util(`duration-${k}`, { 'transition-duration': v });
util('ease-in-out', { 'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)' });
util('ease-out', { 'transition-timing-function': 'cubic-bezier(0,0,0.2,1)' });
for (const [k, v] of Object.entries({ 95: '.95', 100: '1', 105: '1.05', 110: '1.1' })) util(`scale-${k}`, { transform: `scale(${v})` });
util('rotate-45', { transform: 'rotate(45deg)' });
util('rotate-90', { transform: 'rotate(90deg)' });
util('rotate-180', { transform: 'rotate(180deg)' });
util('bg-gradient-to-r', { 'background-image': 'linear-gradient(to right, var(--tw-gradient-stops))' });
util('bg-gradient-to-br', { 'background-image': 'linear-gradient(to bottom right, var(--tw-gradient-stops))' });
util('bg-gradient-to-b', { 'background-image': 'linear-gradient(to bottom, var(--tw-gradient-stops))' });
util('bg-clip-text', { '-webkit-background-clip': 'text', 'background-clip': 'text' });
util('text-transparent', { color: 'transparent' });
util('bg-cover', { 'background-size': 'cover' });
util('bg-center', { 'background-position': 'center' });
util('bg-no-repeat', { 'background-repeat': 'no-repeat' });
util('object-contain', { 'object-fit': 'contain' });
util('object-cover', { 'object-fit': 'cover' });
util('backdrop-blur', { '-webkit-backdrop-filter': 'blur(8px)', 'backdrop-filter': 'blur(8px)' });
util('backdrop-blur-sm', { '-webkit-backdrop-filter': 'blur(4px)', 'backdrop-filter': 'blur(4px)' });
util('backdrop-blur-lg', { '-webkit-backdrop-filter': 'blur(16px)', 'backdrop-filter': 'blur(16px)' });
util('resize-none', { resize: 'none' });
util('appearance-none', { appearance: 'none', '-webkit-appearance': 'none' });
util('list-none', { 'list-style': 'none' });
util('align-middle', { 'vertical-align': 'middle' });
util('touch-none', { 'touch-action': 'none' });
util('will-change-transform', { 'will-change': 'transform' });
util('origin-center', { 'transform-origin': 'center' });
util('sr-only', { position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', 'white-space': 'nowrap', 'border-width': '0' });
for (const [k, v] of Object.entries({ 1: '1', 2: '2', 3: '3', none: 'none' })) {
  if (v === 'none') util('aspect-none', { 'aspect-ratio': 'auto' });
}
util('aspect-square', { 'aspect-ratio': '1 / 1' });
util('aspect-video', { 'aspect-ratio': '16 / 9' });
util('space-y-0', {}); // placeholder to keep API predictable
// space-between using owl selector
for (const [k, v] of Object.entries(spacing)) {
  add(`.${esc(`space-y-${k}`)} > * + *`, { 'margin-top': v });
  add(`.${esc(`space-x-${k}`)} > * + *`, { 'margin-left': v });
}
for (const [k, v] of Object.entries({ 0: '0px', 2: '0.5rem', 4: '1rem' })) {
  add(`.${esc(`divide-y > * + *`)}`, { 'border-top-width': '1px' });
}

/* --------------------------------------------------------------- assemble */
let out = preflight + '\n\n/* utilities */\n';
for (const { selector, decls } of rules) {
  if (Object.keys(decls).length === 0) continue;
  out += `${selector} {\n${declString(decls)}\n}\n`;
}
// responsive blocks
for (const [bp, minw] of Object.entries(screens)) {
  const bucket = responsiveBuckets[bp];
  if (!bucket.length) continue;
  out += `\n@media (min-width: ${minw}) {\n`;
  for (const { selector, decls } of bucket) {
    out += `${selector} {\n${declString(decls)}\n}\n`;
  }
  out += `}\n`;
}

// Append any custom component layer authored in src/input.css (after @tailwind)
const inputPath = path.join(__dirname, '..', 'src', 'input.css');
if (fs.existsSync(inputPath)) {
  const custom = fs.readFileSync(inputPath, 'utf8').replace(/@tailwind[^;]*;/g, '');
  out += '\n/* custom layer (src/input.css) */\n' + custom + '\n';
}

const outPath = path.join(__dirname, '..', 'dist', 'tailwind.css');
fs.writeFileSync(outPath, out);
console.log(`Generated ${outPath} (${(out.length / 1024).toFixed(1)} KB, ${rules.length} rules)`);
