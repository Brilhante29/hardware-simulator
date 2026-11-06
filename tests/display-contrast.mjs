// Checks the real CSS tokens, rather than a second copy of the palette.
// This covers text contrast, not every WCAG criterion or every rendered pixel.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../src/display.css', import.meta.url), 'utf8');
const rules = [...css.matchAll(/(:root[^{}]*)\{([^{}]+)\}/g)];
assert.equal(rules.length, 4, 'Expected light, dark and their accessible palettes');
function luminance(hex) {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map(c => c + c).join('');
  const rgb = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const pairs = ['ink', 'muted', 'accent', 'accent2', 'warning', 'danger']
  .flatMap(fg => ['paper', 'surface', 'panel'].map(bg => [fg, bg]));
pairs.push(['action-ink', 'action'], ['danger', 'danger-bg']);
let base = {}, total = 0;
for (const [index, [, selector, body]] of rules.entries()) {
  const own = Object.fromEntries([...`${body}}`.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{3,6})(?=;|})/g)].map(m => [m[1], m[2]]));
  if (index === 0) base = own;
  const palette = { ...base, ...own };
  let minimum = Infinity;
  for (const [fg, bg] of pairs) {
    assert.ok(palette[fg] && palette[bg], `Missing tokens: ${fg}/${bg}`);
    const [low, high] = [luminance(palette[fg]), luminance(palette[bg])].sort((a, b) => a - b);
    const ratio = (high + 0.05) / (low + 0.05);
    assert.ok(ratio >= 4.5, `${selector}: ${fg}/${bg} = ${ratio.toFixed(2)}:1`);
    minimum = Math.min(minimum, ratio);
    total++;
  }
  console.log(`✓ ${selector}: minimum text contrast ${minimum.toFixed(2)}:1`);
}
console.log(`✓ ${total} text/background pairs pass 4.5:1`);
