// Página de boot: carrega um firmware.hex e roda no chip certo (Uno ou Mega 2560, pela tabela de vetores) em tempo real.
import { createMcu, CLOCK } from '../emulator/avr.mjs';
import * as devices from '../emulator/devices.mjs';
import { bindCircuit, applyControls, wireNets } from '../core/bind.mjs';
const catalog = window.HSCatalog;
const $ = id => document.getElementById(id);
// Placas do catálogo (a mesma arte e os mesmos pinos do editor): a primeira placa (não chip nu) de cada microcontrolador.
const BOARDS = Object.fromEntries(['atmega328p', 'atmega2560'].map(mcu => { const def = catalog.parts.find(d => d.board?.mcu === mcu && !d.board.bare);
  return [mcu, { def, digital: def.board.pins.filter(p => p[0] === 'D').length, analog: def.board.analog, serials: def.board.serial.length > 1 ? def.board.serial.length : 0, pos: Object.fromEntries(def.pins.filter(([n]) => def.board.pins.includes(n)).map(([n, x, y]) => [n, [x, y]])) }]; }));
// Bancada: toda peça do catálogo com `fw` e `bench` (fiação padrão) aparece aqui, ligada pelo mesmo core/bind.mjs do editor.
const BENCH = catalog.parts.filter(d => d.fw && d.bench);
const benchOn = new Map(BENCH.map(d => [d.type, !!d.bench.on])), benchValues = new Map(BENCH.map(d => [d.type, Object.fromEntries((d.controls || []).map(c => [c[0], c[6]]))]));
let bound = [];
let board = null;
let lineBufs = ['', '', '', ''], audio = null, mcu = null, running = false, raf = 0, last = 0, hexText = '', fileName = '', fileHandle = null, lastModified = 0, watchTimer = 0, perf = 1, pressed = new Set();

// Placa em pixel art + indicadores de pino; troca quando o firmware é de outro chip.
function showBoard(id) {
  if (board === BOARDS[id]) return; board = BOARDS[id]; const { def, pos } = board;
  $('boardWrap').classList.toggle('tall', def.height > 300);
  $('boardWrap').innerHTML = window.PixelParts.art(def, { settings: {} }) + Object.entries(pos).map(([n, [x, y]]) => `<span class="pin-dot" data-pin="${n}" style="left:${(x / def.width) * 100}%;top:${(y / def.height) * 100}%" title="${n}"></span>`).join('');
  $('pinGrid').innerHTML = [...Array(board.digital)].map((_, i) => `<button type="button" data-in="D${i}" disabled>D${i}</button>`).join('');
  const keep = $('aPin').value; $('aPin').innerHTML = [...Array(board.analog)].map((_, i) => `<option>A${i}</option>`).join(''); if (keep && +keep.slice(1) < board.analog) $('aPin').value = keep;
  $('serialPort').hidden = !board.serials; $('serialPort').innerHTML = [...Array(board.serials || 1)].map((_, i) => `<option value="${i}">${i ? 'Serial' + i : 'Serial'}</option>`).join('');
  for (const p of [...pressed]) if (!pos[p]) pressed.delete(p);
}
showBoard('atmega328p');

function fmt(n, d = 3) { return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function serialPrint(text) { const el = $('serial'); el.textContent = (el.textContent + text).slice(-20000); el.scrollTop = el.scrollHeight; }
function load(text, name) {
  try { mcu = createMcu(text); } catch (e) { serialPrint(`\n[erro] ${e.message}\n`); return false; }
  hexText = text; fileName = name || 'firmware.hex'; showBoard(mcu.chip.id);
  // Serial0 sai como está; Serial1–3 (Mega) saem por linha com o prefixo da porta.
  const decs = [0, 1, 2, 3].map(() => new TextDecoder()); lineBufs = ['', '', '', ''];
  // Linhas das outras portas esperam a Serial0 terminar a linha dela, para não cortar uma frase no meio.
  const atLineStart = () => /(^|\n)$/.test($('serial').textContent);
  mcu.onSerial = (b, i = 0) => {
    const t = decs[i].decode(new Uint8Array([b]), { stream: true });
    if (!i) { serialPrint(t); if (lineBufs[0] && atLineStart()) { serialPrint(lineBufs[0]); lineBufs[0] = ''; } return; }
    lineBufs[i] += t; const cut = lineBufs[i].lastIndexOf('\n'); if (cut < 0) return;
    const lines = lineBufs[i].slice(0, cut + 1).split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean).map(l => `[Serial${i}] ${l}\n`).join(''); lineBufs[i] = lineBufs[i].slice(cut + 1);
    if (atLineStart()) serialPrint(lines); else lineBufs[0] += lines;
  };
  mcu.onPinChange = () => {}; // estado lido a cada quadro
  mcu.analog[+$('aPin').value.slice(1)] = Number($('a0Slider').value);
  for (const p of pressed) mcu.setInput(p, 0);
  bench();
  const key = 'hs-boot-eeprom-' + (name || 'firmware.hex');
  try { const saved = localStorage.getItem(key); if (saved) mcu.eeprom.set(saved.match(/../g).map(h => parseInt(h, 16))); } catch {}
  mcu.onEeprom = () => { clearTimeout(mcu._ee); mcu._ee = setTimeout(() => { try { localStorage.setItem(key, Array.from(mcu.eeprom, b => b.toString(16).padStart(2, '0')).join('')); } catch {} }, 300); };
  $('dropHint').hidden = true; $('runButton').disabled = false; $('resetButton').disabled = false;
  $('chipInfo').textContent = `${mcu.chip.name} · ${mcu.chip.board} · 16 MHz · ${fileName} · ${mcu.programSize.toLocaleString('pt-BR')} bytes`; document.title = `Boot · ${mcu.chip.board}`;
  paint(); return true;
}
// Monta um circuito virtual (placa + peças ligadas na fiação de bancada) e liga pelo binder; endereço I²C repetido não entra.
function bench() {
  const io = board.def.board, boardPart = { id: 'board', type: board.def.type, name: board.def.name, settings: {} }, parts = [boardPart], wires = [], used = new Map(), notes = [];
  const pinOf = v => v === '$sck' ? io.sck : v === '$mosi' ? io.mosi : v;
  for (const d of BENCH) { if (!benchOn.get(d.type)) continue;
    if (d.fw.bus === 'i2c') { const who = used.get(d.fw.address); if (who) { notes.push(`${d.name}: 0x${d.fw.address.toString(16)} já é do ${who} (mesmo endereço no barramento)`); continue; } used.set(d.fw.address, d.name); wires.push([d.type, 'SDA', io.sda], [d.type, 'SCL', io.scl]); }
    for (const [pin, to] of Object.entries(d.bench.wires || {})) wires.push([d.type, pin, pinOf(to)]);
    parts.push({ id: d.type, type: d.type, name: d.name, settings: { sensor: benchValues.get(d.type) } }); }
  const circuit = { parts, wires: wires.map(([p, pin, to], i) => ({ id: 'w' + i, a: { part: p, pin }, b: { part: 'board', pin: to } })) };
  const r = bindCircuit({ mcu, board: boardPart, io, parts, defFor: t => catalog.get(t), net: wireNets(circuit), devices, now: Date.now() - new Date().getTimezoneOffset() * 60e3 });
  for (const n of [...notes, ...r.notes]) serialPrint(`[bancada] ${n}\n`);
  for (const b of r.bound) applyControls(b.def, b.part, b.device);
  bound = r.bound; views();
}
// Uma janela por peça que mostra algo: texto (lines, LCD) ou imagem (pixel monocromático ou rgba colorido).
function views() {
  $('benchViews').innerHTML = bound.filter(({ device: d }) => d.lines || d.pixel || d.rgba).map(({ part, device: d }) => `<div class="dev"><span class="label">${part.name}</span>${d.lines ? `<pre class="lcd-view" data-view="${part.id}"></pre>` : `<canvas data-view="${part.id}" width="${d.width}" height="${d.height}" class="${d.rgba ? 'round' : ''}" role="img" aria-label="Tela: ${part.name}"></canvas>`}</div>`).join('');
}
function renderBench() {
  $('benchList').innerHTML = BENCH.map(d => { const on = benchOn.get(d.type), where = d.fw.bus === 'i2c' ? `I²C 0x${d.fw.address.toString(16).toUpperCase()}` : Object.entries(d.bench.wires || {}).map(([a, b]) => `${a}→${b.replace('$sck', 'SCK').replace('$mosi', 'MOSI')}`).join(' ');
    return `<div class="bench-item"><label><input type="checkbox" data-bench="${d.type}" ${on ? 'checked' : ''}> ${d.name} <small>${where}</small></label>${on ? (d.controls || []).map(([k, label, unit, min, max, step]) => `<label class="bench-ctl">${label} <input type="number" data-ctl="${d.type}:${k}" min="${min}" max="${max}" step="${step}" value="${benchValues.get(d.type)[k]}"> ${unit}</label>`).join('') : ''}</div>`; }).join('');
}
renderBench();
$('benchList').addEventListener('change', e => { const t = e.target.dataset.bench; if (!t) return; benchOn.set(t, e.target.checked); renderBench(); if (hexText) reboot('bancada alterada'); });
$('benchList').addEventListener('input', e => { const c = e.target.dataset.ctl; if (!c) return; const [t, k] = c.split(':'); benchValues.get(t)[k] = Number(e.target.value); const b = bound.find(x => x.part.type === t); if (b) { b.part.settings.sensor = benchValues.get(t); applyControls(b.def, b.part, b.device); } });
function boot() { if (!mcu) return; running = true; last = 0; $('runButton').textContent = '⏸ Pausar'; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
function pause() { running = false; sound(0); $('runButton').textContent = '▶ Continuar'; cancelAnimationFrame(raf); }
function reboot(note) { if (!hexText) return; const was = running || !mcu; load(hexText, fileName); serialPrint(`\n── ${note || 'reset'} ──\n`); if (was) boot(); }
function frame(now) {
  if (!running) return;
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
  const t0 = performance.now(); if (dt) mcu.run(Math.round(dt * CLOCK)); const cost = performance.now() - t0;
  if (dt) perf = perf * 0.9 + 0.1 * Math.min(9.9, (dt * 1000) / Math.max(cost, 0.01));
  if (mcu.halted) { serialPrint(`\n[parado: ${mcu.lastError}]\n`); pause(); }
  paint(); raf = requestAnimationFrame(frame);
}
function paint() {
  if (!mcu) return;
  const pins = mcu.pinSnapshot();
  for (const el of document.querySelectorAll('.pin-dot')) {
    const p = pins[el.dataset.pin]; el.className = 'pin-dot ' + (p.mode === 'output' ? (p.level ? 'high' : 'low') : 'in');
    el.style.setProperty('--duty', p.mode === 'output' ? String(p.duty ?? p.level) : '0');
  }
  document.querySelector('#boardWrap .ledL')?.classList.toggle('on', pins.D13.mode === 'output' && pins.D13.level === 1);
  for (const b of document.querySelectorAll('[data-in]')) { const p = pins[b.dataset.in]; b.disabled = p.mode === 'output'; b.classList.toggle('on', pressed.has(b.dataset.in)); b.title = p.mode === 'output' ? 'Saída' : p.mode === 'input_pullup' ? 'Entrada com pull-up' : 'Entrada'; }
  $('clock').textContent = `t = ${fmt(mcu.time)} s · ≈ ${fmt(mcu.powerUsage().averageMa, 1)} mA · ${running ? fmt(perf, 1) + '× folga' : 'pausado'}`;
  for (const { part, device: d } of bound) { const el = document.querySelector(`[data-view="${part.id}"]`); if (!el) continue;
    if (d.lines) { // caracteres criados (CGRAM) viram os 5×8 pontos de verdade
      const g = d.glyphs?.() || {}, esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const cell = rows => `<svg class="lcd-glyph" viewBox="0 0 5 8">${rows.map((bits, y) => [0, 1, 2, 3, 4].filter(x => (bits >> (4 - x)) & 1).map(x => `<rect x="${x}" y="${y}" width=".9" height=".9"/>`).join('')).join('')}</svg>`;
      const html = d.lines().map((l, r) => [...l].map((ch, c) => g[`${r},${c}`] ? cell(g[`${r},${c}`]) : esc(ch)).join('')).join('\n');
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } el.classList.toggle('dark', d.backlight === false); continue; }
    if (el._v === d.version) continue; el._v = d.version; const ctx = el.getContext('2d');
    if (d.rgba) { ctx.putImageData(new ImageData(d.rgba(), d.width, d.height), 0, 0); continue; }
    const img = ctx.createImageData(d.width, d.height); for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) { const on = d.on && d.pixel(x, y), i = (y * d.width + x) * 4; img.data[i] = on ? 140 : 6; img.data[i + 1] = on ? 220 : 12; img.data[i + 2] = on ? 255 : 28; img.data[i + 3] = 255; } ctx.putImageData(img, 0, 0); }
  const items = []; let toneHz = 0;
  for (const name of Object.keys(pins)) { const p = mcu.pulseInfo(name); if (!p || !p.periodUs) continue;
    if (p.periodUs > 15000 && p.periodUs < 25000 && p.highUs > 400 && p.highUs < 2600) items.push(`${name} · servo ${Math.round((p.highUs - 544) / (2400 - 544) * 180)}° (${Math.round(p.highUs)} µs)`);
    else { items.push(`${name} · ${fmt(p.hz, 1)} Hz · ${Math.round(p.highUs / p.periodUs * 100)}%`); if (!toneHz && p.hz > 20 && p.hz < 20000) toneHz = p.hz; } }
  const neo = Object.keys(pins).map(n => [n, mcu.neopixel(n)]).filter(([, f]) => f);
  $('neoView').innerHTML = neo.map(([n, f]) => `<div><small>${n} · WS2812 ×${f.length}</small>${f.map(c => `<i style="background:rgb(${c.join(',')});box-shadow:0 0 8px rgb(${c.join(',')})"></i>`).join('')}</div>`).join('');
  $('pulseView').innerHTML = items.length ? items.map(t => `<li>${t}</li>`).join('') : '<li>—</li>';
  sound(running && $('soundOn').checked ? toneHz : 0);
}
function sound(hz) {
  try {
    if (hz && !audio) { const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; g.gain.value = 0.04; o.connect(g).connect(ac.destination); o.start(); audio = { ac, o }; }
    if (audio) { if (hz) audio.o.frequency.setTargetAtTime(hz, audio.ac.currentTime, 0.01); else { audio.o.stop(); audio.ac.close(); audio = null; } }
  } catch {}
}
async function readFile(file) { const text = await file.text(); if (load(text, file.name)) { serialPrint(`── boot: ${file.name} ──\n`); boot(); } }

$('pickButton').onclick = () => $('fileInput').click();
$('fileInput').onchange = e => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; };
$('drop').ondragover = e => { e.preventDefault(); $('drop').classList.add('over'); };
$('drop').ondragleave = () => $('drop').classList.remove('over');
$('drop').ondrop = async e => {
  e.preventDefault(); $('drop').classList.remove('over');
  const item = e.dataTransfer.items?.[0];
  if (item?.getAsFileSystemHandle) { try { const h = await item.getAsFileSystemHandle(); if (h?.kind === 'file') { fileHandle = h; const f = await h.getFile(); lastModified = f.lastModified; startWatch(); return readFile(f); } } catch {} }
  const f = e.dataTransfer.files[0]; if (f) readFile(f);
};
$('runButton').onclick = () => running ? pause() : boot();
$('resetButton').onclick = () => reboot('reset');
// Vigiar: a cada pio run o arquivo muda e o chip reinicia sozinho (Chrome/Edge).
function startWatch() {
  clearInterval(watchTimer); $('watchButton').classList.add('on'); $('watchButton').textContent = '👁 Vigiando';
  watchTimer = setInterval(async () => { try { const f = await fileHandle.getFile(); if (f.lastModified !== lastModified) { lastModified = f.lastModified; hexText = await f.text(); fileName = f.name; reboot('firmware novo'); } } catch {} }, 700);
}
$('watchButton').onclick = async () => {
  if (!window.showOpenFilePicker) { serialPrint('\n[vigiar] Este navegador não permite vigiar arquivos. Use Chrome ou Edge, ou recarregue o .hex à mão.\n'); return; }
  try { [fileHandle] = await showOpenFilePicker({ types: [{ description: 'Firmware Intel HEX', accept: { 'text/plain': ['.hex'] } }] }); const f = await fileHandle.getFile(); lastModified = f.lastModified; startWatch(); readFile(f); } catch {}
};
$('pinGrid').onclick = e => {
  const b = e.target.closest('[data-in]'); if (!b || b.disabled) return;
  const n = b.dataset.in, on = !pressed.has(n); if (on) pressed.add(n); else pressed.delete(n);
  if (!mcu) return paint();
  // Contato real trepida: 2–5 trocas com 50–500 µs entre elas antes de assentar (desligável).
  const final = on ? 0 : null, other = on ? null : 0; mcu.setInput(n, final);
  if ($('bounceOn').checked) { let t = mcu.cycles, v = final; const flips = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < flips; i++) { t += Math.round((50 + Math.random() * 450) * 16); v = v === final ? other : final; const x = v; mcu.schedule(t, () => mcu.setInput(n, x)); } if (v !== final) mcu.schedule(t + Math.round((50 + Math.random() * 450) * 16), () => mcu.setInput(n, final)); }
  paint();
};
$('a0Slider').oninput = e => { const v = Number(e.target.value); $('a0Value').textContent = fmt(v, 2) + ' V'; if (mcu) mcu.analog[+$('aPin').value.slice(1)] = v; };
$('aPin').onchange = () => { if (mcu) mcu.analog[+$('aPin').value.slice(1)] = Number($('a0Slider').value); };
$('serialForm').onsubmit = e => { e.preventDefault(); if (!mcu) return; mcu.serialInput($('serialText').value + '\n', Math.min(+$('serialPort').value || 0, mcu.uarts.length - 1)); $('serialText').value = ''; };
$('clearSerial').onclick = () => { $('serial').textContent = ''; };
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); } });

