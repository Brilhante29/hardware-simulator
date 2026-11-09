// Placa de circuito impresso a partir do circuito do editor: netlist → posicionamento → roteamento em 2 camadas → DRC.
// Tudo em milímetros, y para baixo, origem no canto de cima à esquerda da placa. Sem dependências: roda no navegador e no Node.
import { footprintFor, headerFootprint } from './footprints.mjs';

// Regras padrão de fabricação de baixo custo (2 camadas, 1 oz): trilha e isolação de 0,2 mm já são o mínimo comum (≈ 0,127 mm);
// usamos 0,25/0,2 para sobrar margem. Via 0,6 mm com furo 0,3 mm.
export const RULES = { grid: 0.2, trace: 0.25, clearance: 0.2, via: 0.6, drill: 0.3, edge: 0.5, gap: 0.4, viaCost: 14 };

// ---------- netlist ----------
// catalog: { get(type) } — o catálogo de peças (src/parts/catalog.js); no navegador, o global HSCatalog.
export function buildNetlist(circuit, catalog = globalThis.HSCatalog) {
  if (!catalog) throw Error('buildNetlist precisa do catálogo de peças (src/parts/catalog.js).');
  const defFor = t => catalog.get(t);
  const parent = new Map(), find = x => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const key = (part, pin) => `${part}:${pin}`;
  for (const w of circuit.wires || []) { const a = find(key(w.a.part, w.a.pin)), b = find(key(w.b.part, w.b.pin)); if (a !== b) parent.set(a, b); }
  const errors = [], warnings = [], comps = [], refs = new Set(), counters = {};
  const used = id => [...new Set((circuit.wires || []).flatMap(w => [w.a, w.b]).filter(e => e.part === id).map(e => e.pin))];
  // Nome da rede: o de um trilho (pcb.net: GND, +5V…); senão o rótulo do pino da placa/chip (A4, D5…); senão N1, N2…
  const groups = new Map(); for (const k of parent.keys()) { const r = find(k); (groups.get(r) || groups.set(r, []).get(r)).push(k); }
  const defOf = new Map((circuit.parts || []).map(p => [p.id, defFor(p.type)])), netName = new Map(); let auto = 0; const taken = new Set();
  for (const [root, members] of groups) {
    const rail = members.map(m => defOf.get(m.split(':')[0])?.pcb?.net).find(Boolean);
    let name = rail || null;
    if (!name) { const m = members.find(x => defOf.get(x.split(':')[0])?.board); if (m) name = m.split(':')[1]; }
    if (!name || (taken.has(name) && !rail)) name = `N${++auto}`;
    taken.add(name); netName.set(root, name);
  }
  const netOfPin = (partId, pin) => parent.has(key(partId, pin)) ? netName.get(find(key(partId, pin))) : null;
  const rails = new Set();
  for (const part of circuit.parts || []) {
    const def = defFor(part.type), f = footprintFor(part, used(part.id), def);
    if (!f) continue;
    if (f.net) { rails.add(f.net); continue; }
    if (f.refuse) { errors.push(`${part.name}: ${f.refuse}`); continue; }
    let ref = (String(part.name || '').match(/^([A-Z]{1,3}\d{1,3})\b/) || [])[1];
    if (!ref || refs.has(ref)) { const n = (counters[f.ref] || 0) + 1; counters[f.ref] = n; ref = `${f.ref}${n}`; while (refs.has(ref)) ref = `${f.ref}${++counters[f.ref]}`; }
    refs.add(ref);
    // pcb.merge: pinos da peça que viram o mesmo pad no footprint (GND2 do DIP-28 → pads GND do TQFP-32).
    const merged = Object.entries(def?.pcb?.merge || {}), netOf = pin => netOfPin(part.id, pin) ?? merged.filter(([, to]) => to === pin).map(([from]) => netOfPin(part.id, from)).find(Boolean) ?? null;
    comps.push({ id: part.id, ref, value: f.value, lcsc: f.lcsc, fp: f.fp, type: part.type, module: !!f.module, padNets: f.fp.pads.map(p => netOf(p.pin)) });
    if (f.module) warnings.push(`${ref} (${part.name}) entra como conector de ${f.fp.pads.length} pinos para o módulo pronto.`);
  }
  // Trilho de alimentação do circuito (não o GND) vira conector de entrada: na placa real vem de um regulador, boost ou USB.
  for (const net of [...rails].filter(n => n !== 'GND')) {
    comps.push({ id: `__pwr_${net}`, ref: 'J0', value: `Entrada ${net}`, lcsc: '', fp: headerFootprint([net, 'GND']), type: 'power', module: false, padNets: [net, 'GND'] });
    warnings.push(`J0: o trilho ${net} do circuito vira um conector de entrada; numa placa real ele vem de um conversor boost ou do USB.`);
  }
  const names = [...new Set(comps.flatMap(c => c.padNets).filter(Boolean))].sort();
  const nets = names.map(name => ({ name, pads: comps.flatMap((c, ci) => c.padNets.map((n, pi) => n === name ? [ci, pi] : null).filter(Boolean)) }));
  for (const n of nets) if (n.pads.length === 1) warnings.push(`Rede ${n.name} tem um pad só (${comps[n.pads[0][0]].ref}): nada para ligar.`);
  return { comps, nets, errors, warnings };
}

// ---------- geometria da placa ----------
export function boardBox(board) { return board.shape === 'round' ? { w: board.d, h: board.d } : { w: board.w, h: board.h }; }
export function insideBoard(board, x, y, margin = 0) {
  if (board.shape === 'round') { const r = board.d / 2; return Math.hypot(x - r, y - r) <= r - margin; }
  return x >= margin && y >= margin && x <= board.w - margin && y <= board.h - margin;
}
const rotXY = (x, y, rot) => rot === 90 ? [-y, x] : rot === 180 ? [-x, -y] : rot === 270 ? [y, -x] : [x, y];
// Pads de um componente posicionado, em coordenadas da placa.
export function padsOf(comp, pl) {
  return comp.fp.pads.map((p, i) => { const [dx, dy] = rotXY(p.x, p.y, pl.rot), swap = pl.rot === 90 || pl.rot === 270; return { ...p, i, net: comp.padNets[i], x: pl.x + dx, y: pl.y + dy, w: swap ? p.h : p.w, h: swap ? p.w : p.h }; });
}
export function courtyard(comp, pl) { const [cw, ch] = comp.fp.court, swap = pl.rot === 90 || pl.rot === 270, w = swap ? ch : cw, h = swap ? cw : ch; return { x0: pl.x - w / 2, y0: pl.y - h / 2, x1: pl.x + w / 2, y1: pl.y + h / 2 }; }
const snap = (v, g) => Math.round(v / g) * g;

// ---------- posicionamento automático ----------
// Guloso por conectividade: o componente com mais pads no centro; depois, sempre o mais ligado aos já postos, na posição e
// rotação de menor comprimento de ligação que caiba na placa sem invadir a área de outro.
export function autoPlace(nl, board, rules = RULES) {
  const { w, h } = boardBox(board), placed = new Array(nl.comps.length).fill(null), netPads = new Map();
  const fits = (c, pl) => { const b = courtyard(c, pl); for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) if (!insideBoard(board, x, y, rules.edge)) return false;
    for (let j = 0; j < placed.length; j++) { if (!placed[j]) continue; const o = courtyard(nl.comps[j], placed[j]); if (b.x0 < o.x1 + rules.gap && b.x1 + rules.gap > o.x0 && b.y0 < o.y1 + rules.gap && b.y1 + rules.gap > o.y0) return false; } return true; };
  const commit = (ci, pl) => { placed[ci] = pl; for (const p of padsOf(nl.comps[ci], pl)) if (p.net) (netPads.get(p.net) || netPads.set(p.net, []).get(p.net)).push(p); };
  const order = nl.comps.map((c, i) => i).sort((a, b) => nl.comps[b].fp.pads.length - nl.comps[a].fp.pads.length);
  const first = order[0]; if (first === undefined) return { placements: placed, ok: true };
  const c0 = { x: snap(w / 2, rules.grid), y: snap(h / 2, rules.grid), rot: 0 };
  if (!fits(nl.comps[first], c0)) return { placements: placed, ok: false, failed: nl.comps[first].ref };
  commit(first, c0);
  const left = new Set(order.slice(1));
  const links = ci => nl.comps[ci].padNets.filter(n => n && netPads.has(n) && n !== 'GND' && n !== '+5V').length;
  while (left.size) {
    let ci = -1, best = -1; for (const c of left) { const l = links(c); if (l > best) { best = l; ci = c; } } left.delete(ci);
    const comp = nl.comps[ci], step = Math.max(rules.grid, Math.min(1, w / 60));
    let bestPl = null, bestCost = Infinity;
    for (let y = rules.edge; y <= h - rules.edge; y += step) for (let x = rules.edge; x <= w - rules.edge; x += step) for (const rot of [0, 90, 180, 270]) {
      const pl = { x: snap(x, rules.grid), y: snap(y, rules.grid), rot };
      let cost = 0.02 * Math.hypot(pl.x - w / 2, pl.y - h / 2);
      for (const p of padsOf(comp, pl)) { const others = p.net && netPads.get(p.net); if (!others) continue; let d = Infinity; for (const o of others) d = Math.min(d, Math.abs(o.x - p.x) + Math.abs(o.y - p.y)); cost += (p.net === 'GND' || p.net === '+5V' ? 0.3 : 1) * d; }
      if (cost < bestCost && fits(comp, pl)) { bestCost = cost; bestPl = pl; }
    }
    if (!bestPl) return { placements: placed, ok: false, failed: comp.ref };
    commit(ci, bestPl);
  }
  return { placements: placed, ok: true };
}
// Aumenta a placa até tudo caber (relógio: diâmetro em passos de 2 mm).
export function placeGrowing(nl, board, rules = RULES, max = 120) {
  let b = { ...board };
  for (let i = 0; i < 60; i++) { const r = autoPlace(nl, b, rules); if (r.ok) return { board: b, placements: r.placements }; b = b.shape === 'round' ? { ...b, d: b.d + 2 } : { ...b, w: b.w + 2, h: b.h + 2 }; if ((b.d || b.w) > max) break; }
  return { board: b, placements: null };
}

// ---------- roteamento (labirinto A* em grade, 2 camadas, 45°) ----------
class Heap { constructor() { this.k = []; this.v = []; } push(k, v) { const a = this.k, b = this.v; let i = a.length; a.push(k); b.push(v); while (i) { const p = (i - 1) >> 1; if (a[p] <= k) break; a[i] = a[p]; b[i] = b[p]; i = p; } a[i] = k; b[i] = v; }
  pop() { const a = this.k, b = this.v, top = b[0], lk = a.pop(), lv = b.pop(), n = a.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && a[c + 1] < a[c]) c++; if (a[c] >= lk) break; a[i] = a[c]; b[i] = b[c]; i = c; } a[i] = lk; b[i] = lv; } return top; } get size() { return this.k.length; } }

export function route(nl, placements, board, rules = RULES, first = []) {
  const g = rules.grid, { w, h } = boardBox(board), nx = Math.floor(w / g) + 1, ny = Math.floor(h / g) + 1, N = nx * ny;
  const netId = new Map(nl.nets.map((n, i) => [n.name, i + 1])); let lone = nl.nets.length + 1;
  const pads = []; nl.comps.forEach((c, ci) => { if (placements[ci]) for (const p of padsOf(c, placements[ci])) pads.push({ ...p, ci, id: p.net ? netId.get(p.net) : lone++ }); });
  const owner = [new Int32Array(N), new Int32Array(N)], block = [new Int32Array(N), new Int32Array(N)], land = [new Int32Array(N), new Int32Array(N)], edge = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!insideBoard(board, i * g, j * g, rules.edge + rules.trace / 2)) edge[j * nx + i] = 1;
  const mark = (L, idx, id) => { const b = block[L][idx]; block[L][idx] = b === 0 || b === id ? id : -1; };
  const cellsIn = (x0, y0, x1, y1, fn) => { for (let j = Math.max(0, Math.ceil(y0 / g)); j <= Math.min(ny - 1, Math.floor(y1 / g)); j++) for (let i = Math.max(0, Math.ceil(x0 / g)); i <= Math.min(nx - 1, Math.floor(x1 / g)); i++) fn(i, j, j * nx + i); };
  const disk = (x, y, r, fn) => cellsIn(x - r, y - r, x + r, y + r, (i, j, idx) => { if ((i * g - x) ** 2 + (j * g - y) ** 2 < r * r) fn(idx); });
  const halo = rules.clearance + rules.trace / 2;
  for (const p of pads) for (const L of p.drill ? [0, 1] : [0]) {
    if (p.shape === 'circle') { const r = p.w / 2; disk(p.x, p.y, r + halo, idx => mark(L, idx, p.id)); disk(p.x, p.y, r, idx => { owner[L][idx] = p.id; }); disk(p.x, p.y, Math.max(g * 0.75, r - rules.trace / 2), idx => { land[L][idx] = p.id; }); }
    else {
      const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y0 = p.y - p.h / 2, y1 = p.y + p.h / 2, s = rules.trace / 2;
      cellsIn(x0 - halo, y0 - halo, x1 + halo, y1 + halo, (i, j, idx) => { const dx = Math.max(x0 - i * g, 0, i * g - x1), dy = Math.max(y0 - j * g, 0, j * g - y1); if (dx * dx + dy * dy < halo * halo) mark(L, idx, p.id); });
      cellsIn(x0, y0, x1, y1, (i, j, idx) => { owner[L][idx] = p.id; });
      cellsIn(Math.min(p.x, x0 + s), Math.min(p.y, y0 + s), Math.max(p.x, x1 - s), Math.max(p.y, y1 - s), (i, j, idx) => { land[L][idx] = p.id; });
    }
  }
  const free = (L, idx, id) => !edge[idx] && (land[L][idx] === id || (land[L][idx] === 0 && (block[L][idx] === 0 || block[L][idx] === id)));
  const viaR = rules.via / 2 + rules.clearance + rules.trace / 2, viaCells = Math.ceil(viaR / g);
  const viaOk = (idx, id) => {
    if (edge[idx] || land[0][idx] || land[1][idx]) return false;
    const i0 = idx % nx, j0 = (idx - i0) / nx;
    for (let dj = -viaCells; dj <= viaCells; dj++) for (let di = -viaCells; di <= viaCells; di++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= ny || (di * di + dj * dj) * g * g >= viaR * viaR) continue;
      const k = j * nx + i; for (const L of [0, 1]) { const o = owner[L][k]; if (o && o !== id) return false; }
    }
    return true;
  };
  const traceR = rules.clearance + rules.trace + 0.01;
  const commitCell = (L, idx, id) => { owner[L][idx] = id; const i = idx % nx, j = (idx - i) / nx; disk(i * g, j * g, traceR, k => mark(L, k, id)); };
  const commitVia = (idx, id) => { const i = idx % nx, j = (idx - i) / nx; for (const L of [0, 1]) { disk(i * g, j * g, rules.via / 2, k => { owner[L][k] = id; }); disk(i * g, j * g, viaR, k => mark(L, k, id)); } };

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  const dist = new Float32Array(2 * N), prev = new Int32Array(2 * N), seen = new Uint32Array(2 * N); let stamp = 0;
  function astar(sources, targets, id, tx, ty) {
    stamp++; const heap = new Heap(), hfn = s => { const idx = s % N, i = idx % nx, j = (idx - i) / nx, dx = Math.abs(i - tx), dy = Math.abs(j - ty); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    for (const s of sources) { seen[s] = stamp; dist[s] = 0; prev[s] = -1; heap.push(hfn(s), s); }
    let expanded = 0;
    while (heap.size) {
      const s = heap.pop(), L = s >= N ? 1 : 0, idx = s % N; if (targets.has(s)) return s;
      if (++expanded > 400000) return -1;
      const i = idx % nx, j = (idx - i) / nx, d0 = dist[s];
      for (const [di, dj, c] of DIRS) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const k = jj * nx + ii; if (!free(L, k, id)) continue;
        if (di && dj && (!free(L, j * nx + ii, id) || !free(L, jj * nx + i, id))) continue;
        const t = L * N + k, nd = d0 + c; if (seen[t] === stamp && dist[t] <= nd) continue;
        seen[t] = stamp; dist[t] = nd; prev[t] = s; heap.push(nd + hfn(t), t);
      }
      const o = (1 - L) * N + idx, nd = d0 + rules.viaCost;
      if ((seen[o] !== stamp || dist[o] > nd) && free(1 - L, idx, id) && viaOk(idx, id)) { seen[o] = stamp; dist[o] = nd; prev[o] = s; heap.push(nd + hfn(o), o); }
    }
    return -1;
  }

  // Ordem: redes de sinal curtas primeiro; GND e +5V por último (são as que mais se espalham).
  const padCells = p => { const out = []; for (const L of p.drill ? [0, 1] : [0]) for (let idx = 0; idx < N; idx++) if (land[L][idx] === p.id && Math.abs((idx % nx) * g - p.x) <= p.w / 2 + g && Math.abs(Math.floor(idx / nx) * g - p.y) <= p.h / 2 + g) out.push(L * N + idx); return out; };
  const work = nl.nets.map(n => { const ps = pads.filter(p => p.net === n.name); let len = 0; for (let a = 1; a < ps.length; a++) len += Math.min(...ps.slice(0, a).map(q => Math.abs(q.x - ps[a].x) + Math.abs(q.y - ps[a].y))); return { n, ps, len, power: n.name === 'GND' || n.name === '+5V' }; })
    .filter(x => x.ps.length > 1).sort((a, b) => (first.indexOf(b.n.name) - first.indexOf(a.n.name)) || (a.power - b.power) || (a.len - b.len));
  const paths = [], vias = [], unrouted = [];
  for (const { n, ps } of work) {
    const id = netId.get(n.name), tree = new Set(padCells(ps[0])), done = [ps[0]], todo = ps.slice(1);
    while (todo.length) {
      // próximo pad: o mais perto de algo já ligado
      todo.sort((a, b) => Math.min(...done.map(q => Math.hypot(q.x - a.x, q.y - a.y))) - Math.min(...done.map(q => Math.hypot(q.x - b.x, q.y - b.y))));
      const p = todo.shift(), targets = new Set(padCells(p));
      if (!targets.size) { unrouted.push({ net: n.name, ref: nl.comps[p.ci].ref, pin: p.pin, why: 'pad sem área livre' }); continue; }
      const end = astar(tree, targets, id, Math.round(p.x / g), Math.round(p.y / g));
      if (end < 0) { unrouted.push({ net: n.name, ref: nl.comps[p.ci].ref, pin: p.pin, x: p.x, y: p.y }); continue; }
      const cells = []; for (let s = end; s !== -1; s = prev[s]) cells.push(s); cells.reverse();
      for (let k = 0; k < cells.length; k++) { const s = cells[k], L = s >= N ? 1 : 0, idx = s % N; commitCell(L, idx, id); tree.add(s); if (k && (cells[k - 1] >= N) !== (s >= N)) { commitVia(idx, id); vias.push({ x: (idx % nx) * g, y: Math.floor(idx / nx) * g, net: n.name }); tree.add((1 - L) * N + idx); } }
      for (const t of targets) tree.add(t);
      paths.push({ net: n.name, cells: cells.map(s => ({ L: s >= N ? 1 : 0, x: (s % N % nx) * g, y: Math.floor(s % N / nx) * g })) });
      done.push(p);
    }
  }
  return { traces: toSegments(paths, rules.trace), vias, unrouted, pads };
}
// Células do caminho → segmentos retos (junta passos na mesma direção e camada).
function toSegments(paths, width) {
  const segs = [];
  for (const { net, cells } of paths) {
    let s = 0, d = null;
    const flush = (i, j) => { if (j > i) segs.push({ net, layer: cells[i].L, x1: +cells[i].x.toFixed(3), y1: +cells[i].y.toFixed(3), x2: +cells[j].x.toFixed(3), y2: +cells[j].y.toFixed(3), w: width }); };
    for (let k = 1; k < cells.length; k++) {
      const a = cells[k - 1], b = cells[k];
      if (b.L !== a.L) { flush(s, k - 1); s = k; d = null; continue; }
      const dir = `${Math.sign(Math.round((b.x - a.x) * 1e3))},${Math.sign(Math.round((b.y - a.y) * 1e3))}`;
      if (d === null) d = dir; else if (dir !== d) { flush(s, k - 1); s = k - 1; d = dir; }
    }
    flush(s, cells.length - 1);
  }
  return segs;
}

// ---------- DRC independente do roteador: geometria exata ----------
const dPtSeg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0; return Math.hypot(px - x1 - t * dx, py - y1 - t * dy); };
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const segsCross = (a, b) => { const d1 = cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1), d2 = cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2), d3 = cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1), d4 = cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2); return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4; };
const dSegSeg = (a, b) => segsCross(a, b) ? 0 : Math.min(dPtSeg(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2), dPtSeg(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2), dPtSeg(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2), dPtSeg(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2));
const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const rectEdges = r => [[r.x0, r.y0, r.x1, r.y0], [r.x1, r.y0, r.x1, r.y1], [r.x1, r.y1, r.x0, r.y1], [r.x0, r.y1, r.x0, r.y0]].map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 }));
const dSegRect = (s, r) => inRect(s.x1, s.y1, r) || inRect(s.x2, s.y2, r) ? 0 : Math.min(...rectEdges(r).map(e => dSegSeg(s, e)));
// item: { kind: 'seg'|'rect', layer(s), net, x1,y1,x2,y2,r } — círculo é segmento de comprimento zero com raio.
function itemDist(a, b) {
  if (a.kind === 'rect' && b.kind === 'rect') { const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0); return Math.hypot(dx, dy); }
  if (a.kind === 'rect') return dSegRect(b, a) - b.r;
  if (b.kind === 'rect') return dSegRect(a, b) - a.r;
  return dSegSeg(a, b) - a.r - b.r;
}
const bbox = it => it.kind === 'rect' ? it : { x0: Math.min(it.x1, it.x2) - it.r, y0: Math.min(it.y1, it.y2) - it.r, x1: Math.max(it.x1, it.x2) + it.r, y1: Math.max(it.y1, it.y2) + it.r };

export function copperItems(routed) {
  const items = [];
  routed.pads.forEach((p, k) => { const layers = p.drill ? [0, 1] : [0], net = p.net || `#${p.ci}.${p.i}`, what = `pad ${p.pin} de ${p.ref || ''}`;
    if (p.shape === 'circle') items.push({ kind: 'seg', layers, net, x1: p.x, y1: p.y, x2: p.x, y2: p.y, r: p.w / 2, pad: k, what });
    else items.push({ kind: 'rect', layers, net, x0: p.x - p.w / 2, y0: p.y - p.h / 2, x1: p.x + p.w / 2, y1: p.y + p.h / 2, pad: k, what }); });
  for (const s of routed.traces) items.push({ kind: 'seg', layers: [s.layer], net: s.net, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, r: s.w / 2, what: `trilha ${s.net}` });
  for (const v of routed.vias) items.push({ kind: 'seg', layers: [0, 1], net: v.net, x1: v.x, y1: v.y, x2: v.x, y2: v.y, r: v.r || 0.3, via: true, what: `via ${v.net}` });
  for (const it of items) it.box = bbox(it);
  return items;
}

export function drc(nl, placements, board, routed, rules = RULES) {
  const items = copperItems(routed), violations = [];
  routed.pads.forEach(p => { p.ref = nl.comps[p.ci].ref; });
  items.forEach(it => { if (it.pad !== undefined) it.what = `pad ${routed.pads[it.pad].pin} de ${routed.pads[it.pad].ref}`; });
  const tol = 1e-6;
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const A = items[a], B = items[b]; if (A.net === B.net || !A.layers.some(l => B.layers.includes(l))) continue;
    if (A.box.x0 - rules.clearance > B.box.x1 || B.box.x0 - rules.clearance > A.box.x1 || A.box.y0 - rules.clearance > B.box.y1 || B.box.y0 - rules.clearance > A.box.y1) continue;
    const d = itemDist(A, B); if (d < rules.clearance - tol) violations.push({ type: d <= 0 ? 'curto' : 'isolação', d: +d.toFixed(3), msg: `${A.what} e ${B.what}: ${d <= 0 ? 'encostam (curto)' : `${d.toFixed(3)} mm < ${rules.clearance} mm`}`, x: (A.box.x0 + A.box.x1) / 2, y: (A.box.y0 + A.box.y1) / 2 });
  }
  // borda da placa
  const edgeMin = rules.edge * 0.5;
  for (const it of items) { const pts = it.kind === 'rect' ? [[it.x0, it.y0], [it.x1, it.y0], [it.x0, it.y1], [it.x1, it.y1]] : [[it.x1, it.y1], [it.x2, it.y2]], r = it.kind === 'rect' ? 0 : it.r;
    if (pts.some(([x, y]) => !insideBoard(board, x, y, edgeMin + r))) violations.push({ type: 'borda', msg: `${it.what} a menos de ${edgeMin} mm da borda`, x: pts[0][0], y: pts[0][1] }); }
  // componentes sobrepostos ou fora da placa
  nl.comps.forEach((c, i) => { const pl = placements[i]; if (!pl) { violations.push({ type: 'posição', msg: `${c.ref} sem posição` }); return; } const b = courtyard(c, pl);
    if (![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => insideBoard(board, x, y))) violations.push({ type: 'posição', msg: `${c.ref} sai da placa`, x: pl.x, y: pl.y });
    for (let j = i + 1; j < nl.comps.length; j++) { if (!placements[j]) continue; const o = courtyard(nl.comps[j], placements[j]); if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) violations.push({ type: 'posição', msg: `${c.ref} invade ${nl.comps[j].ref}`, x: pl.x, y: pl.y }); } });
  // conectividade: cobre da mesma rede encostado (por camada); vias e pads furados ligam as camadas
  const parent = items.map((_, i) => i), f = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) { const A = items[a], B = items[b]; if (A.net !== B.net || !A.layers.some(l => B.layers.includes(l))) continue; if (A.box.x0 > B.box.x1 + tol || B.box.x0 > A.box.x1 + tol || A.box.y0 > B.box.y1 + tol || B.box.y0 > A.box.y1 + tol) continue; if (itemDist(A, B) <= tol) parent[f(a)] = f(b); }
  const open = [];
  for (const n of nl.nets) { const ids = items.map((it, i) => it.pad !== undefined && it.net === n.name ? i : -1).filter(i => i >= 0); if (ids.length < 2) continue; const roots = new Set(ids.map(f)); if (roots.size > 1) open.push({ net: n.name, pieces: roots.size }); }
  for (const o of open) violations.push({ type: 'aberto', msg: `rede ${o.net} em ${o.pieces} pedaços (falta ligação)` });
  return { ok: violations.length === 0, violations, open, stats: { traces: routed.traces.length, vias: routed.vias.length, length: +routed.traces.reduce((s, t) => s + Math.hypot(t.x2 - t.x1, t.y2 - t.y1), 0).toFixed(1) } };
}

// Tudo de uma vez: netlist, posição (aumentando a placa se precisar), roteamento com novas tentativas e DRC.
export function designBoard(circuit, board = { shape: 'round', d: 40 }, rules = RULES, given = null, catalog = globalThis.HSCatalog) {
  const nl = buildNetlist(circuit, catalog);
  if (nl.errors.length) return { nl, errors: nl.errors };
  let placed = given ? { board, placements: given } : placeGrowing(nl, board, rules);
  if (!placed.placements) return { nl, errors: [`Os componentes não cabem numa placa de até ${board.shape === 'round' ? 'Ø' : ''}120 mm.`] };
  // Rasga e refaz: as redes que ficaram sem rota passam para o começo da fila na tentativa seguinte.
  let best = null, first = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = route(nl, placed.placements, placed.board, { ...rules, viaCost: rules.viaCost + (attempt % 3) * 4 }, first);
    if (!best || r.unrouted.length < best.unrouted.length) best = r;
    if (!r.unrouted.length) break;
    for (const u of r.unrouted) { first = first.filter(n => n !== u.net); first.push(u.net); }
  }
  const check = drc(nl, placed.placements, placed.board, best, rules);
  return { nl, board: placed.board, placements: placed.placements, routed: best, drc: check, errors: [] };
}
