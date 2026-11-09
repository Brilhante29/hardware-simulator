// Página de PCB: carrega o circuito (exemplo, pasta do projeto ou o editor), posiciona, roteia num Worker, mostra a placa
// em 2D/3D/por baixo, deixa mover componentes com mouse, toque ou teclado e exporta o .zip de fabricação.
import { RULES, padsOf, courtyard, boardBox, designBoard } from './pcb.mjs';
import { fabricationModel, fabricationZip } from './gerber.mjs';

const $ = s => document.querySelector(s);
const STORE = 'hs-pcb-v1', EDITOR_KEY = 'hardware-simulator-project-v1';
const MASKS = { green: ['#1f6f4a', '#17583a'], black: ['#1c1d1f', '#0e0f10'], purple: ['#4b2a7a', '#371f5b'], blue: ['#1d4f91', '#153a6c'], white: ['#e9ece8', '#c9cdc8'] };
const state = { circuit: null, title: 'Placa', board: { shape: 'round', d: 40 }, design: null, mode: '2d', layers: { bodies: true, top: true, bottom: true, silk: true, rats: true }, mask: 'green', selected: null, marker: null };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = v => +v.toFixed(3);

// ---------- Worker com reserva síncrona (file:// ou navegador sem module worker) ----------
let worker = null, seq = 0; const waiting = new Map();
try { worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); worker.onmessage = ({ data }) => { waiting.get(data.id)?.(data); waiting.delete(data.id); }; worker.onerror = () => { worker = null; }; } catch { worker = null; }
function design(placements) {
  const msg = { circuit: state.circuit, board: state.board, placements };
  if (!worker) { const t = performance.now(); return Promise.resolve({ design: designBoard(msg.circuit, msg.board, RULES, placements), ms: performance.now() - t }); }
  return new Promise(res => { const id = ++seq; waiting.set(id, res); worker.postMessage({ ...msg, id }); });
}

// ---------- carregar ----------
async function loadCircuit() {
  const q = new URLSearchParams(location.search);
  if (q.get('example')) { const r = await fetch(`examples/pcb/${q.get('example').replace(/[^\w-]/g, '')}.json`); if (r.ok) return [await r.json(), 'exemplo']; }
  try { const h = await (await fetch('api/health')).json(); if (h.project) { const p = await (await fetch('api/project')).json(); if (p.circuit) return [p.circuit, `pasta ${p.name}`]; } } catch {}
  try { const c = JSON.parse(localStorage.getItem(EDITOR_KEY)); if (c?.parts?.length) return [c, 'editor']; } catch {}
  const r = await fetch('examples/pcb/relogio-placa.json'); return r.ok ? [await r.json(), 'exemplo'] : [null, ''];
}
const keyOf = c => (c.parts || []).map(p => `${p.id}:${p.type}`).join('|');
function saved() { try { const s = JSON.parse(localStorage.getItem(STORE)); return s && s.key === keyOf(state.circuit) ? s : null; } catch { return null; } }
function persist() { try { const d = state.design; localStorage.setItem(STORE, JSON.stringify({ key: keyOf(state.circuit), board: d.board, mask: state.mask, placements: Object.fromEntries(d.nl.comps.map((c, i) => [c.id, d.placements[i]])) })); } catch {} }

// ---------- desenho ----------
function bodySvg(c) {
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
function render() {
  const d = state.design, scene = $('#scene'); if (!d) return;
  const { w, h } = boardBox(d.board), vb = `-2 -2 ${f2(w + 4)} ${f2(h + 4)}`, [maskC, edgeC] = MASKS[state.mask];
  const shape = (fill, extra = '') => d.board.shape === 'round' ? `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}" fill="${fill}" ${extra}/>` : `<rect width="${w}" height="${h}" rx="1" fill="${fill}" ${extra}/>`;
  const L = state.layers, model = fabricationModel(d, state.title);
  let base = shape(maskC, `stroke="${edgeC}" stroke-width=".3"`);
  if (L.bottom) base += `<g stroke="#5aa9e6" stroke-linecap="round" opacity=".55">${d.routed.traces.filter(t => t.layer === 1).map(t => `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke-width="${t.w}"/>`).join('')}</g>`;
  if (L.top) base += `<g stroke="#8fd18b" stroke-linecap="round" opacity=".9">${d.routed.traces.filter(t => t.layer === 0).map(t => `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke-width="${t.w}"/>`).join('')}</g>`;
  base += `<g fill="#d4a94a">${model.pads.map(p => p.shape === 'circle' ? `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${f2(p.w / 2)}"/>` : `<rect x="${f2(p.x - p.w / 2)}" y="${f2(p.y - p.h / 2)}" width="${f2(p.w)}" height="${f2(p.h)}" rx=".08"/>`).join('')}</g>`;
  base += `<g fill="#171717">${model.pads.filter(p => p.drill).map(p => `<circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="${p.drill / 2}"/>`).join('')}</g>`;
  base += `<g>${d.routed.vias.map(v => `<circle cx="${v.x}" cy="${v.y}" r="${RULES.via / 2}" fill="#d4a94a"/><circle cx="${v.x}" cy="${v.y}" r="${RULES.drill / 2}" fill="#171717"/>`).join('')}</g>`;
  if (L.silk) base += `<g stroke="#f4f4f0" stroke-width=".15" fill="#f4f4f0">${model.silk.map(([a, b, c, e]) => `<line x1="${f2(a)}" y1="${f2(b)}" x2="${f2(c)}" y2="${f2(e)}"/>`).join('')}<path stroke="none" d="${model.dots.map(([x, y]) => `M${f2(x - .1)} ${f2(y - .1)}h.2v.2h-.2z`).join('')}"/></g>`;
  if (L.rats) base += `<g stroke="#ffcc00" stroke-width=".18" stroke-dasharray=".5 .35">${ratsnest(d)}</g>`;
  if (state.marker) base += `<circle class="marker" cx="${state.marker.x}" cy="${state.marker.y}" r="1.4"/>`;
  const comps = d.nl.comps.map((c, i) => { const pl = d.placements[i]; if (!pl) return ''; const b = courtyard(c, pl);
    return `<g class="comp${state.selected === i ? ' selected' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(`${c.ref}, ${c.value}, em ${pl.x.toFixed(1)} por ${pl.y.toFixed(1)} mm, ${pl.rot} graus`)}"><rect class="sel" x="${f2(b.x0)}" y="${f2(b.y0)}" width="${f2(b.x1 - b.x0)}" height="${f2(b.y1 - b.y0)}" fill="transparent"/>${L.bodies ? `<g transform="translate(${pl.x} ${pl.y}) rotate(${pl.rot})" pointer-events="none" aria-hidden="true">${bodySvg(c)}</g>` : ''}</g>`; }).join('');
  const edges = [6, 5, 4, 3, 2, 1].map(z => `<svg class="edge-3d" viewBox="${vb}" style="transform:translateZ(-${z}px)" aria-hidden="true">${shape(edgeC)}</svg>`).join('');
  scene.innerHTML = `${edges}<svg viewBox="${vb}" role="img" aria-label="Placa ${esc(state.title)}: ${d.nl.comps.length} componentes, ${d.drc.stats.traces} trechos de trilha, ${d.drc.stats.vias} vias">${base}</svg><svg class="bodies-3d" viewBox="${vb}" aria-label="Componentes">${comps}</svg>`;
  bindComps();
}
function ratsnest(d) {
  const out = [], pads = d.routed.pads;
  for (const u of d.routed.unrouted) { const p = pads.find(x => d.nl.comps[x.ci].ref === u.ref && x.pin === u.pin); if (!p) continue; let best = null, bd = Infinity; for (const q of pads) if (q !== p && q.net === p.net) { const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = q; } } if (best) out.push(`<line x1="${f2(p.x)}" y1="${f2(p.y)}" x2="${f2(best.x)}" y2="${f2(best.y)}"/>`); }
  return out.join('');
}
function panel() {
  const d = state.design, st = $('#drcStatus'), un = d.routed.unrouted.length, v = d.drc.violations;
  st.className = 'status ' + (d.drc.ok && !un ? 'ok' : 'bad');
  st.textContent = d.drc.ok && !un ? `✓ Placa sem violações: pronta para fabricar` : `${v.length} problema(s)${un ? `, ${un} ligação(ões) sem rota` : ''}`;
  const { w, h } = boardBox(d.board);
  $('#stats').innerHTML = [['Placa', d.board.shape === 'round' ? `Ø ${d.board.d} mm` : `${w} × ${h} mm`], ['Componentes', d.nl.comps.length], ['Redes', d.nl.nets.length], ['Trilhas', `${d.drc.stats.traces} trechos · ${d.drc.stats.length} mm`], ['Vias', d.drc.stats.vias], ['Regras', `${RULES.trace}/${RULES.clearance} mm, via ${RULES.via}/${RULES.drill}`], ['Roteado em', `${state.ms.toFixed(0)} ms`]].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('#drcList').innerHTML = v.slice(0, 60).map((x, i) => `<li><button data-v="${i}">${esc(x.msg)}</button></li>`).join('');
  $('#drcList').querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const x = v[+b.dataset.v]; if (x.x !== undefined) { state.marker = { x: x.x, y: x.y }; render(); } });
  $('#notes').innerHTML = [...d.nl.warnings, ...d.routed.unrouted.map(u => `Sem rota: ${u.ref}.${u.pin} (rede ${u.net}). Mova componentes ou aumente a placa.`)].map(n => `<li>${esc(n)}</li>`).join('');
  $('#bom tbody').innerHTML = d.nl.comps.map(c => `<tr><td>${esc(c.ref)}</td><td>${esc(c.value)}</td><td>${esc(c.fp.name)}</td><td>${esc(c.lcsc || '—')}</td></tr>`).join('');
}

// ---------- ações ----------
let busy = 0;
async function run(placements) {
  const my = ++busy; $('#view').classList.add('busy'); $('#drcStatus').textContent = 'Roteando…';
  const r = await design(placements); if (my !== busy) return;
  $('#view').classList.remove('busy');
  if (r.error || r.design.errors?.length) { $('#drcStatus').className = 'status bad'; $('#drcStatus').textContent = r.error || r.design.errors.join(' '); return; }
  state.design = r.design; state.ms = r.ms; state.board = r.design.board; syncBoardInputs(); render(); panel(); persist();
}
function syncBoardInputs() { $('#shape').value = state.board.shape; $('#size').value = state.board.shape === 'round' ? state.board.d : `${state.board.w}×${state.board.h}`; }
function readBoardInputs() {
  const shape = $('#shape').value, raw = $('#size').value.replace(',', '.');
  if (shape === 'round') { const d = Math.max(15, Math.min(120, parseFloat(raw) || 40)); return { shape, d }; }
  const [a, b] = raw.split(/[x×*]/i).map(parseFloat); return { shape, w: Math.max(15, Math.min(160, a || 50)), h: Math.max(15, Math.min(160, b || a || 30)) };
}
let rerouteTimer = 0; const reroute = () => { clearTimeout(rerouteTimer); rerouteTimer = setTimeout(() => run(state.design.placements), 120); };
function move(i, dx, dy, rot = 0) {
  const pl = state.design.placements[i], g = RULES.grid, snap = v => Math.round(v / g) * g;
  state.design.placements[i] = { x: f2(snap(pl.x + dx)), y: f2(snap(pl.y + dy)), rot: (pl.rot + rot) % 360 };
}
function bindComps() {
  const svg = $('#scene .bodies-3d');
  svg.querySelectorAll('.comp').forEach(el => {
    const i = +el.dataset.i;
    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 1 : RULES.grid, k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (k) { e.preventDefault(); move(i, ...k); state.selected = i; render(); reroute(); requestAnimationFrame(() => $(`#scene .comp[data-i="${i}"]`)?.focus()); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); move(i, 0, 0, 90); render(); reroute(); requestAnimationFrame(() => $(`#scene .comp[data-i="${i}"]`)?.focus()); }
    });
    el.addEventListener('focus', () => { state.selected = i; el.classList.add('selected'); });
    el.addEventListener('blur', () => el.classList.remove('selected'));
    el.addEventListener('pointerdown', e => {
      if (state.mode !== '2d') return; e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('dragging'); state.selected = i;
      const m = svg.getScreenCTM().inverse(), pt = ev => { const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m); return [p.x, p.y]; };
      let [lx, ly] = pt(e); const start = { ...state.design.placements[i] }; let moved = false;
      const onMove = ev => { const [x, y] = pt(ev); const dx = x - lx, dy = y - ly; if (Math.abs(dx) < RULES.grid && Math.abs(dy) < RULES.grid) return; move(i, dx, dy); [lx, ly] = [lx + dx, ly + dy]; moved = true; const pl = state.design.placements[i]; el.querySelector('g')?.setAttribute('transform', `translate(${pl.x} ${pl.y}) rotate(${pl.rot})`); const b = courtyard(state.design.nl.comps[i], pl), s = el.querySelector('.sel'); s.setAttribute('x', b.x0); s.setAttribute('y', b.y0); };
      const onUp = () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.classList.remove('dragging'); if (moved) run(state.design.placements); else { state.design.placements[i] = start; el.focus(); } };
      el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp);
    });
  });
}
// 3D: arrastar no fundo gira a placa.
(() => { let spin = -24, drag = null; const v = $('#view');
  v.addEventListener('pointerdown', e => { if (state.mode === '3d') { drag = e.clientX; v.setPointerCapture(e.pointerId); } });
  v.addEventListener('pointermove', e => { if (drag !== null) { spin += (e.clientX - drag) * 0.4; drag = e.clientX; v.style.setProperty('--spin', `${spin}deg`); } });
  v.addEventListener('pointerup', () => { drag = null; }); })();

function download(name, bytes) { const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function wire() {
  $('#autoButton').onclick = () => { state.board = readBoardInputs(); run(null); };
  $('#routeButton').onclick = () => { state.board = readBoardInputs(); run(state.design?.placements || null); };
  $('#shape').onchange = () => { $('#size').value = $('#shape').value === 'round' ? 40 : '50×30'; };
  $('#mask').onchange = () => { state.mask = $('#mask').value; render(); persist(); };
  $('#exportButton').onclick = () => { if (!state.design) return; const z = fabricationZip(state.design, RULES, state.title); download(`${state.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'placa'}-fabricacao.zip`, z); $('#drcStatus').textContent = `Arquivos de fabricação baixados (${(z.length / 1024).toFixed(0)} KB).`; };
  $('#importButton').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async () => { const f = $('#importFile').files[0]; if (!f) return; try { const c = JSON.parse(await f.text()); if (!Array.isArray(c.parts)) throw 0; start(c, f.name); } catch { $('#drcStatus').textContent = 'Arquivo não é um circuito do Hardware Studio.'; } };
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; $('#view').dataset.mode = state.mode; document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  document.querySelectorAll('[data-layer]').forEach(c => c.onchange = () => { state.layers[c.dataset.layer] = c.checked; render(); });
}
function start(circuit, from) {
  state.circuit = circuit; state.title = String(circuit.title || 'Placa').slice(0, 40); $('#title').textContent = `${state.title} · ${from}`; document.title = `${state.title} · PCB · Hardware Studio`;
  const s = saved(); let placements = null;
  if (s) { state.board = s.board; state.mask = s.mask || 'green'; $('#mask').value = state.mask; const ids = circuit.parts.map(p => p.id); placements = null; state.pending = s.placements; }
  syncBoardInputs();
  // posições guardadas: só se todos os componentes ainda existirem (a ordem vem da netlist)
  run(null).then(() => { if (s && state.design && state.design.nl.comps.every(c => s.placements[c.id])) run(state.design.nl.comps.map(c => s.placements[c.id])); });
}
wire();
loadCircuit().then(([c, from]) => { if (!c) { $('#drcStatus').textContent = 'Nenhum circuito: monte um no Editor ou abra um arquivo.'; return; } start(c, from); });
