// Página de boot: carrega um firmware.hex e roda no chip certo (Uno ou Mega 2560, pela tabela de vetores) em tempo real.
import { createMcu, CLOCK } from '../emulator/avr.mjs';
import { LcdI2C, Ssd1306, Bme280, Mpu6050, Bh1750, Ds3231, Dht } from '../emulator/devices.mjs';
const $ = id => document.getElementById(id);
// Mesmas posições de pino das placas do editor.
const BOARDS = {
  atmega328p: { def: { type: 'uno', width: 182, height: 220, pins: [] }, digital: 14, analog: 6, pos: { ...Object.fromEntries([...Array(14)].map((_, i) => [`D${i}`, [0, 26 + i * 12]])), ...Object.fromEntries([0, 1, 2, 3, 4, 5].map(i => [`A${i}`, [182, 38 + i * 20]])) } },
  atmega2560: { def: { type: 'mega', width: 182, height: 340, pins: [] }, digital: 54, analog: 16, serials: 4, pos: { ...Object.fromEntries([...Array(22)].map((_, i) => [`D${i}`, [0, 26 + i * 12]])), ...Object.fromEntries([...Array(16)].map((_, i) => [`A${i}`, [182, 30 + i * 12]])), ...Object.fromEntries([...Array(32)].map((_, i) => [`D${22 + i}`, [16 + (i >> 1) * 10, i & 1 ? 328 : 340]])) } },
};
let board = null;
let lineBufs = ['', '', '', ''], sensors = {}, lcd = null, oled = null, audio = null, mcu = null, running = false, raf = 0, last = 0, hexText = '', fileName = '', fileHandle = null, lastModified = 0, watchTimer = 0, perf = 1, pressed = new Set();

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
  lcd = $('lcdOn').checked ? mcu.attachI2C(0x27, new LcdI2C()) : null; oled = $('oledOn').checked ? mcu.attachI2C(0x3c, new Ssd1306()) : null;
  sensors = {};
  const on = k => document.querySelector(`[data-dev="${k}"]`).checked;
  if (on('bme')) sensors.bme = mcu.attachI2C(0x76, new Bme280());
  if (on('rtc')) sensors.rtc = mcu.attachI2C(0x68, new Ds3231({ start: Date.now() }));
  else if (on('mpu')) sensors.mpu = mcu.attachI2C(0x68, new Mpu6050());
  if (on('bh')) sensors.bh = mcu.attachI2C(0x23, new Bh1750());
  if (on('dht')) sensors.dht = mcu.attachPinDevice('D4', new Dht({ type: 22 }));
  applySensors();
  const key = 'hs-boot-eeprom-' + (name || 'firmware.hex');
  try { const saved = localStorage.getItem(key); if (saved) mcu.eeprom.set(saved.match(/../g).map(h => parseInt(h, 16))); } catch {}
  mcu.onEeprom = () => { clearTimeout(mcu._ee); mcu._ee = setTimeout(() => { try { localStorage.setItem(key, Array.from(mcu.eeprom, b => b.toString(16).padStart(2, '0')).join('')); } catch {} }, 300); };
  $('dropHint').hidden = true; $('runButton').disabled = false; $('resetButton').disabled = false;
  $('chipInfo').textContent = `${mcu.chip.name} · ${mcu.chip.board} · 16 MHz · ${fileName} · ${mcu.programSize.toLocaleString('pt-BR')} bytes`; document.title = `Boot · ${mcu.chip.board}`;
  paint(); return true;
}
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
  if (lcd) $('lcdView').textContent = lcd.lines().join('\n'), $('lcdView').classList.toggle('dark', !lcd.backlight);
  if (oled) { const ctx = $('oledView').getContext('2d'), img = ctx.createImageData(128, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) { const on = oled.on && oled.pixel(x, y), i = (y * 128 + x) * 4; img.data[i] = on ? 140 : 6; img.data[i + 1] = on ? 220 : 12; img.data[i + 2] = on ? 255 : 28; img.data[i + 3] = 255; } ctx.putImageData(img, 0, 0); }
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
  const n = b.dataset.in; if (pressed.has(n)) { pressed.delete(n); mcu?.setInput(n, null); } else { pressed.add(n); mcu?.setInput(n, 0); }
  paint();
};
$('a0Slider').oninput = e => { const v = Number(e.target.value); $('a0Value').textContent = fmt(v, 2) + ' V'; if (mcu) mcu.analog[+$('aPin').value.slice(1)] = v; };
$('aPin').onchange = () => { if (mcu) mcu.analog[+$('aPin').value.slice(1)] = Number($('a0Slider').value); };
$('serialForm').onsubmit = e => { e.preventDefault(); if (!mcu) return; mcu.serialInput($('serialText').value + '\n', Math.min(+$('serialPort').value || 0, mcu.uarts.length - 1)); $('serialText').value = ''; };
$('clearSerial').onclick = () => { $('serial').textContent = ''; };
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); } });

$('lcdOn').onchange = $('oledOn').onchange = () => { if (hexText) reboot('dispositivos alterados'); };

function applySensors() {
  const n = id => Number($(id).value);
  if (sensors.bme) { sensors.bme.temperature = n('bmeT'); sensors.bme.humidity = n('bmeH'); }
  if (sensors.mpu) { const a = n('mpuX') * Math.PI / 180; sensors.mpu.accel = [0, -Math.sin(a), Math.cos(a)]; }
  if (sensors.bh) sensors.bh.lux = n('bhLux');
  if (sensors.dht) { sensors.dht.temperature = n('dhtT'); sensors.dht.humidity = n('dhtH'); }
}
for (const id of ['bmeT', 'bmeH', 'mpuX', 'bhLux', 'dhtT', 'dhtH']) $(id).oninput = applySensors;
document.querySelectorAll('[data-dev]').forEach(c => c.onchange = () => { if (hexText) reboot('sensores alterados'); });
