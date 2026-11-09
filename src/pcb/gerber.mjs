// Arquivos de fabricação: Gerber RS-274X (X2) por camada, furação Excellon, BOM e posição (pick-and-place) em CSV,
// num .zip com os nomes que as fábricas de PCB de baixo custo reconhecem sozinhas (GTL, GBL, GTS, GBS, GTO, GTP, GKO, DRL).
import { padsOf, courtyard, boardBox, insideBoard } from './pcb.mjs';

// Fonte 3×5 para a serigrafia (referências e título): cada ponto vira um quadrado de 0,2 mm.
const FONT = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '-': '000000111000000', '+': '000010111010000', '.': '000000000000010', ' ': '000000000000000' };
const ASCII = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// Pontos (centros) do texto, em mm, a partir do canto de cima à esquerda; altura 5 pontos.
export function textDots(text, x, y, dot = 0.2) {
  const out = []; [...ASCII(text)].forEach((ch, n) => { const g = FONT[ch] || FONT[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') out.push([x + (n * 4 + (k % 3)) * dot + dot / 2, y + Math.floor(k / 3) * dot + dot / 2]); });
  return out;
}
export const textWidth = (text, dot = 0.2) => ASCII(text).length * 4 * dot - dot;

// Tudo o que vai para o cobre/máscara/serigrafia, já em coordenadas da placa (mm, y para baixo).
export function fabricationModel(design, title = 'HARDWARE STUDIO') {
  const { nl, placements, routed, board } = design, pads = [], silk = [], dots = [], boxes = [];
  const { w, h } = boardBox(board);
  // Texto da serigrafia nunca em cima de pad nem de outro componente (a fábrica corta tinta sobre cobre exposto).
  const free = (b, pad = 0.15) => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => insideBoard(board, x, y, 0.6)) && boxes.every(o => b.x0 > o.x1 + pad || b.x1 < o.x0 - pad || b.y0 > o.y1 + pad || b.y1 < o.y0 - pad);
  nl.comps.forEach((c, ci) => { if (placements[ci]) boxes.push(courtyard(c, placements[ci])); });
  for (const p of routed.pads) boxes.push({ x0: p.x - p.w / 2, y0: p.y - p.h / 2, x1: p.x + p.w / 2, y1: p.y + p.h / 2 });
  nl.comps.forEach((c, ci) => {
    const pl = placements[ci]; if (!pl) return;
    for (const p of padsOf(c, pl)) pads.push({ ...p, ref: c.ref });
    const b = courtyard(c, pl), m = 0.1, x0 = b.x0 + m, y0 = b.y0 + m, x1 = b.x1 - m, y1 = b.y1 - m;
    silk.push([x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]);
    const p1 = padsOf(c, pl)[c.fp.pin1 ? c.fp.pads.findIndex(p => p.pin === c.fp.pin1) : 0];
    if (p1) { const dx = p1.x - pl.x, dy = p1.y - pl.y, k = Math.hypot(dx, dy) || 1; dots.push([Math.min(x1 - 0.2, Math.max(x0 + 0.2, pl.x + dx / k * (Math.hypot(x1 - x0, y1 - y0) / 2))), Math.min(y1 - 0.2, Math.max(y0 + 0.2, pl.y + dy / k * (Math.hypot(x1 - x0, y1 - y0) / 2)))]); }
    const tw = textWidth(c.ref), th = 1.0;
    const spots = [[pl.x - tw / 2, b.y0 - th - 0.25], [pl.x - tw / 2, b.y1 + 0.25], [b.x0 - tw - 0.3, pl.y - th / 2], [b.x1 + 0.3, pl.y - th / 2]];
    const at = spots.find(([x, y]) => free({ x0: x, y0: y, x1: x + tw, y1: y + th }));
    if (at) { dots.push(...textDots(c.ref, at[0], at[1])); boxes.push({ x0: at[0], y0: at[1], x1: at[0] + tw, y1: at[1] + th }); }
  });
  const tw = textWidth(title);
  for (let y = h * 0.85; y > h * 0.1; y -= 0.5) { const b = { x0: w / 2 - tw / 2, y0: y, x1: w / 2 + tw / 2, y1: y + 1 }; if (free(b, 0.4)) { dots.push(...textDots(title, b.x0, y)); break; } }
  return { pads, traces: routed.traces, vias: routed.vias, silk, dots, board, w, h };
}

const n6 = v => Math.round(v * 1e6);
function gerber(fn, body, model) {
  const ap = new Map(), lines = [];
  const aperture = def => { if (!ap.has(def)) ap.set(def, 10 + ap.size); return `D${ap.get(def)}*`; };
  const X = x => n6(x), Y = y => n6(model.h - y);
  let cur = null; const use = def => { const d = aperture(def); if (cur !== d) { lines.push(d); cur = d; } };
  body({
    flash(def, x, y) { use(def); lines.push(`X${X(x)}Y${Y(y)}D03*`); },
    line(def, x1, y1, x2, y2) { use(def); lines.push(`X${X(x1)}Y${Y(y1)}D02*`, `X${X(x2)}Y${Y(y2)}D01*`); },
    circle(def, cx, cy, r) { use(def); lines.push('G75*', `X${X(cx + r)}Y${Y(cy)}D02*`, `G03X${X(cx + r)}Y${Y(cy)}I${n6(-r)}J0D01*`, 'G01*'); },
  });
  const defs = [...ap].map(([def, d]) => `%ADD${d}${def}*%`);
  return [`G04 Hardware Studio - ${fn}*`, '%TF.GenerationSoftware,HardwareStudio,pcb,0.1*%', `%TF.FileFunction,${fn}*%`, '%FSLAX46Y46*%', '%MOMM*%', '%LPD*%', 'G01*', ...defs, ...lines, 'M02*', ''].join('\n');
}
const padDef = (p, grow = 0) => p.shape === 'circle' ? `C,${(p.w + 2 * grow).toFixed(4)}` : `R,${(p.w + 2 * grow).toFixed(4)}X${(p.h + 2 * grow).toFixed(4)}`;

export function gerberFiles(model, rules) {
  const top = model.pads, bottom = model.pads.filter(p => p.drill), smd = model.pads.filter(p => !p.drill), mask = 0.05;
  const copper = (pads, layer) => g => { for (const p of pads) g.flash(padDef(p), p.x, p.y); for (const t of model.traces) if (t.layer === layer) g.line(`C,${t.w.toFixed(4)}`, t.x1, t.y1, t.x2, t.y2); for (const v of model.vias) g.flash(`C,${rules.via.toFixed(4)}`, v.x, v.y); };
  const outline = g => { if (model.board.shape === 'round') g.circle('C,0.1000', model.w / 2, model.h / 2, model.w / 2); else { const { w, h } = model; g.line('C,0.1000', 0, 0, w, 0); g.line('C,0.1000', w, 0, w, h); g.line('C,0.1000', w, h, 0, h); g.line('C,0.1000', 0, h, 0, 0); } };
  return {
    'pcb-F_Cu.gtl': gerber('Copper,L1,Top', copper(top, 0), model),
    'pcb-B_Cu.gbl': gerber('Copper,L2,Bot', copper(bottom, 1), model),
    'pcb-F_Mask.gts': gerber('Soldermask,Top', g => { for (const p of top) g.flash(padDef(p, mask), p.x, p.y); }, model),
    'pcb-B_Mask.gbs': gerber('Soldermask,Bot', g => { for (const p of bottom) g.flash(padDef(p, mask), p.x, p.y); }, model),
    'pcb-F_Paste.gtp': gerber('Paste,Top', g => { for (const p of smd) g.flash(padDef(p), p.x, p.y); }, model),
    'pcb-F_Silkscreen.gto': gerber('Legend,Top', g => { for (const [x1, y1, x2, y2] of model.silk) g.line('C,0.1500', x1, y1, x2, y2); for (const [x, y] of model.dots) g.flash('R,0.2000X0.2000', x, y); }, model),
    'pcb-Edge_Cuts.gko': gerber('Profile,NP', outline, model),
  };
}
export function excellon(model, rules) {
  const holes = [...model.vias.map(v => ({ d: rules.drill, x: v.x, y: v.y })), ...model.pads.filter(p => p.drill).map(p => ({ d: p.drill, x: p.x, y: p.y }))];
  const sizes = [...new Set(holes.map(h => h.d.toFixed(3)))].sort();
  const out = ['M48', '; Hardware Studio - furos metalizados (PTH)', 'FMAT,2', 'METRIC,TZ', ...sizes.map((s, i) => `T${i + 1}C${s}`), '%', 'G05'];
  sizes.forEach((s, i) => { out.push(`T${i + 1}`); for (const h of holes) if (h.d.toFixed(3) === s) out.push(`X${h.x.toFixed(3)}Y${(model.h - h.y).toFixed(3)}`); });
  out.push('M30', ''); return out.join('\n');
}
const csv = rows => rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n';
export function bom(design) {
  const groups = new Map();
  for (const c of design.nl.comps) { const k = `${c.value}|${c.fp.name}|${c.lcsc}`; (groups.get(k) || groups.set(k, { c, refs: [] }).get(k)).refs.push(c.ref); }
  return csv([['Comment', 'Designator', 'Footprint', 'Quantity', 'LCSC (sugestão, confira o estoque)'], ...[...groups.values()].map(({ c, refs }) => [c.value, refs.join(' '), c.fp.name, refs.length, c.lcsc || ''])]);
}
export function cpl(design) {
  const { h } = boardBox(design.board);
  return csv([['Designator', 'Mid X', 'Mid Y', 'Layer', 'Rotation'], ...design.nl.comps.map((c, i) => { const pl = design.placements[i]; return [c.ref, `${pl.x.toFixed(3)}mm`, `${(h - pl.y).toFixed(3)}mm`, 'Top', (360 - pl.rot) % 360]; })]);
}

// .zip sem compressão (método 0), suficiente para alguns KB de texto e sem dependências.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder(), chunks = [], central = []; let offset = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? enc.encode(content) : content, nm = enc.encode(name), crc = crc32(data);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0)];
    chunks.push(Uint8Array.from(head), nm, data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nm);
    offset += head.length + nm.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0), n = Object.keys(files).length;
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(n), ...u16(n), ...u32(size), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end], out = new Uint8Array(all.reduce((s, c) => s + c.length, 0)); let k = 0; for (const c of all) { out.set(c, k); k += c.length; } return out;
}
export function fabricationZip(design, rules, title) {
  const model = fabricationModel(design, title);
  const notes = [`Hardware Studio — arquivos de fabricação`, `Placa: ${design.board.shape === 'round' ? `redonda Ø${design.board.d} mm` : `${design.board.w} × ${design.board.h} mm`}, 2 camadas, 1,6 mm, 1 oz.`,
    `Regras usadas: trilha ${rules.trace} mm, isolação ${rules.clearance} mm, via ${rules.via}/${rules.drill} mm.`, `DRC: ${design.drc.ok ? 'sem violações' : design.drc.violations.length + ' violações'}; ${design.drc.stats.traces} trechos de trilha, ${design.drc.stats.vias} vias, ${design.drc.stats.length} mm de cobre.`,
    'Módulos (OLED, RTC, IMU) entram como conectores 1×4 para as placas prontas.', 'Os números LCSC são sugestões: confira valor, encapsulamento e estoque antes do pedido.', ''].join('\n');
  return zip({ ...gerberFiles(model, rules), 'pcb-PTH.drl': excellon(model, rules), 'bom.csv': bom(design), 'cpl.csv': cpl(design), 'LEIA-ME.txt': notes });
}
