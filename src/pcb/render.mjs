// Desenho da placa em SVG (vista de cima), usado pela página de PCB e pela vitrine do relógio.
import { RULES, boardBox } from './pcb.mjs';
import { fabricationModel } from './gerber.mjs';
export const MASKS = { green: ['#1f6f4a', '#17583a'], black: ['#1c1d1f', '#0e0f10'], purple: ['#4b2a7a', '#371f5b'], blue: ['#1d4f91', '#153a6c'], white: ['#e9ece8', '#c9cdc8'] };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = v => +v.toFixed(3);
export function bodySvg(c) {
  const t = c.fp.name, [bw, bh] = c.fp.body;
  const R = (x, y, w, h, fill, extra = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${fill}" ${extra}/>`;
  if (/TQFP/.test(t)) return R(-3.5, -3.5, 7, 7, '#1d1d1f', 'rx=".3"') + `<circle cx="-2.6" cy="-2.6" r=".35" fill="#555"/><text x="0" y=".4" font-size="1.1" text-anchor="middle" fill="#cfcfcf">${esc(c.value.replace('-AU', ''))}</text>`;
  if (/^R_0805/.test(t)) return R(-1, -.62, 2, 1.25, '#1b1b1b') + R(-1, -.62, .35, 1.25, '#c9c9c9') + R(.65, -.62, .35, 1.25, '#c9c9c9');
  if (/^C_0805/.test(t)) return R(-1, -.62, 2, 1.25, '#b98a4f') + R(-1, -.62, .35, 1.25, '#d8d8d8') + R(.65, -.62, .35, 1.25, '#d8d8d8');
  if (/LED/.test(t)) return R(-1, -.62, 2, 1.25, '#f5f5f5') + R(-.4, -.4, .8, .8, '#ff5a4f');
  if (/SOD-123/.test(t)) return R(-1.35, -.8, 2.7, 1.6, '#1b1b1b') + R(-1.35, -.8, .5, 1.6, '#9a9a9a');
  if (/SOT-23/.test(t)) return R(-1.45, -.65, 2.9, 1.3, '#1b1b1b');
  if (/Crystal/.test(t)) return R(-1.6, -1.25, 3.2, 2.5, '#c8ccd0', 'rx=".25"') + R(-1.2, -.15, 2.4, .3, '#9aa0a6');
  if (/SW_PUSH/.test(t)) return R(-3, -3, 6, 6, '#232323', 'rx=".4"') + `<circle r="1.75" fill="#8a8f96"/>`;
  if (/JST/.test(t)) return R(-3, -2.25, 6, 4.5, '#efe3c6', 'rx=".2"') + R(-2.2, -1.6, 4.4, 2.2, '#d8caa4');
  if (/Vibration/.test(t)) return `<circle r="5" fill="none" stroke="#c0c4c9" stroke-width=".25" stroke-dasharray=".8 .5"/>`;
  if (/Buzzer/.test(t)) return `<circle r="6" fill="#1d1d1f"/><circle r="1" fill="#444"/>`;
  if (/Arduino_Nano/.test(t)) return R(-9, -21.6, 18, 43.2, '#1d5fa8', 'rx=".6" opacity=".9"');
  if (/PinHeader/.test(t)) return R(-bw / 2, -bh / 2, bw, bh, '#151515', 'rx=".2"') + c.fp.pads.map(p => R(p.x - .32, p.y - .32, .64, .64, '#d4a94a')).join('');
  return R(-bw / 2, -bh / 2, bw, bh, '#2a2a2a');
}

// Placa montada (máscara, cobre, pads, furos, vias, serigrafia e componentes) como um <svg> independente.
export function boardSvg(design, { mask = 'green', title = '', bodies = true, bottom = true, label = 'Placa de circuito impresso' } = {}) {
  const d = design, { w, h } = boardBox(d.board), [maskC, edgeC] = MASKS[mask] || MASKS.green, model = fabricationModel(d, title);
  const shape = d.board.shape === 'round' ? `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}" fill="${maskC}" stroke="${edgeC}" stroke-width=".3"/>` : `<rect width="${w}" height="${h}" rx="1" fill="${maskC}" stroke="${edgeC}" stroke-width=".3"/>`;
  const line = t => `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke-width="${t.w}"/>`;
  let s = shape;
  if (bottom) s += `<g stroke="#5aa9e6" stroke-linecap="round" opacity=".45">${d.routed.traces.filter(t => t.layer === 1).map(line).join('')}</g>`;
  s += `<g stroke="#8fd18b" stroke-linecap="round" opacity=".85">${d.routed.traces.filter(t => t.layer === 0).map(line).join('')}</g>`;
  s += `<g fill="#d4a94a">${model.pads.map(p => p.shape === 'circle' ? `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(p.w / 2)}"/>` : `<rect x="${f2(p.x - p.w / 2)}" y="${f2(p.y - p.h / 2)}" width="${f2(p.w)}" height="${f2(p.h)}" rx=".08"/>`).join('')}</g>`;
  s += `<g fill="#171717">${model.pads.filter(p => p.drill).map(p => `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${p.drill / 2}"/>`).join('')}</g>`;
  s += d.routed.vias.map(v => `<circle cx="${v.x}" cy="${v.y}" r="${RULES.via / 2}" fill="#d4a94a"/><circle cx="${v.x}" cy="${v.y}" r="${RULES.drill / 2}" fill="#171717"/>`).join('');
  s += `<g stroke="#f4f4f0" stroke-width=".15" fill="#f4f4f0">${model.silk.map(([a, b, c, e]) => `<line x1="${f2(a)}" y1="${f2(b)}" x2="${f2(c)}" y2="${f2(e)}"/>`).join('')}<path stroke="none" d="${model.dots.map(([x, y]) => `M${f2(x - .1)} ${f2(y - .1)}h.2v.2h-.2z`).join('')}"/></g>`;
  if (bodies) s += d.nl.comps.map((c, i) => { const pl = d.placements[i]; return pl ? `<g transform="translate(${pl.x} ${pl.y}) rotate(${pl.rot})">${bodySvg(c)}</g>` : ''; }).join('');
  return `<svg viewBox="-1 -1 ${f2(w + 2)} ${f2(h + 2)}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
