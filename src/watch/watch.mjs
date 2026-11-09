// Vitrine: o firmware examples/firmware/relogio-cor rodando no ATmega328P emulado, a tela GC9A01 pintada a cada quadro,
// o MAX30102/MPU6050/DS3231 respondendo aos controles e a PCB redonda gerada na hora atrás da tela.
import { createMcu, CLOCK } from '../emulator/avr.mjs';
import { Gc9a01, Max30102, Ds3231, Mpu6050 } from '../emulator/devices.mjs';
import { designBoard } from '../pcb/pcb.mjs';
import { boardSvg } from '../pcb/render.mjs';
import { fabricationZip } from '../pcb/gerber.mjs';
import { RULES } from '../pcb/pcb.mjs';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { mcu: null, tft: null, ppg: null, imu: null, walk: 0, lines: [], design: null, painted: -1, last: 0, buzz: false };

async function boot() {
  const hex = await (await fetch('examples/firmware/relogio-cor/relogio-cor-nano.hex')).text();
  const mcu = createMcu(hex, 'atmega328p'), dec = new TextDecoder(); let line = '';
  mcu.onSerial = b => { const ch = dec.decode(new Uint8Array([b]), { stream: true }); if (ch === '\n') { state.lines.push(line.replace(/\r$/, '')); if (state.lines.length > 40) state.lines.shift(); line = ''; serialDirty = true; } else line += ch; };
  state.tft = mcu.attachPinDevice('D10', new Gc9a01({ cs: 'D10', dc: 'D9', rst: 'D8' }));
  state.ppg = mcu.attachI2C(0x57, new Max30102({ bpm: 72 }));
  mcu.attachI2C(0x68, new Ds3231({ start: Date.now() - new Date().getTimezoneOffset() * 60e3, lostPower: false }));
  state.imu = mcu.attachI2C(0x69, new Mpu6050({ address: 0x69 }));
  mcu.analog[0] = 3.9 / 2; mcu.setInput('D2', 1);
  state.mcu = mcu; requestAnimationFrame(frame);
}
let serialDirty = false;
const ctx = $('#screen').getContext('2d');
function frame(now) {
  const m = state.mcu, dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0; state.last = now;
  if (dt) {
    // Caminhada: o módulo da aceleração sobe a ~1,6 g a cada passo, no relógio do chip.
    const ph = (m.time * state.walk / 60) % 1, k = state.walk ? 1 + 0.6 * Math.max(0, Math.sin(2 * Math.PI * ph)) : 1; state.imu.accel = [0, 0, k];
    m.run(Math.round(dt * CLOCK));
  }
  const t = state.tft; if (t.version !== state.painted) { state.painted = t.version; ctx.putImageData(new ImageData(t.rgba(), 240, 240), 0, 0); }
  const vib = !!m.pinSnapshot().D5?.level; if (vib !== state.buzz) { state.buzz = vib; $('#watch').classList.toggle('buzz', vib); }
  if (serialDirty) { serialDirty = false; const el = $('#serial'); el.textContent = state.lines.join('\n'); el.scrollTop = el.scrollHeight; const last = state.lines.at(-1) || ''; const mm = /(\d\d:\d\d):\d\d bpm=(\d+) passos=(\d+)/.exec(last); if (mm) $('#screen').setAttribute('aria-label', `Tela do relógio: ${mm[1]}, ${+mm[2] ? mm[2] + ' batimentos por minuto' : 'sem batimento'}, ${mm[3]} passos`); }
  requestAnimationFrame(frame);
}

// PCB do mesmo circuito com o chip nu, gerada e conferida aqui.
async function board() {
  const c = await (await fetch('examples/pcb/relogio-cor-placa.json')).json(), t = performance.now();
  state.design = designBoard(c, { shape: 'round', d: 40 }); const ms = performance.now() - t, d = state.design;
  $('#pcb').innerHTML = boardSvg(d, { mask: 'black', bodies: true, label: 'Placa redonda do relógio' });
  $('#facts').textContent = `PCB Ø${d.board.d} mm · ${d.nl.comps.length} componentes · ${d.drc.stats.traces} trechos de trilha · ${d.drc.stats.vias} vias · DRC ${d.drc.ok && !d.routed.unrouted.length ? 'sem violações' : 'com pendências'} · roteada em ${ms.toFixed(0)} ms no seu navegador`;
}

// ---------- interação ----------
const watch = $('#watch'), stage = $('#stage');
$('#explode').onclick = () => { const open = !watch.classList.contains('open'); watch.classList.toggle('open', open); stage.classList.toggle('open', open); $('#explode').setAttribute('aria-pressed', String(open)); $('#explode').textContent = open ? 'Fechar o relógio' : 'Abrir em camadas'; watch.style.removeProperty('--rx'); watch.style.removeProperty('--ry'); };
{ let drag = null; stage.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, rx: parseFloat(getComputedStyle(watch).getPropertyValue('--rx')) || 14, ry: parseFloat(getComputedStyle(watch).getPropertyValue('--ry')) || -18 }; watch.classList.add('dragging'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!drag) return; watch.style.setProperty('--ry', `${drag.ry + (e.clientX - drag.x) * 0.4}deg`); watch.style.setProperty('--rx', `${Math.max(-70, Math.min(80, drag.rx - (e.clientY - drag.y) * 0.4))}deg`); });
  stage.addEventListener('pointerup', () => { drag = null; watch.classList.remove('dragging'); }); }
const press = () => { if (!state.mcu) return; state.mcu.setInput('D2', 0); $('#crown').classList.add('down'); setTimeout(() => { state.mcu.setInput('D2', 1); $('#crown').classList.remove('down'); }, 150); };
$('#crown').onclick = press; $('#press').onclick = press;
const bind = (id, fn) => { const el = $(id); el.oninput = () => fn(el.value); fn(el.value); };
bind('#bpm', v => { $('#bpmOut').textContent = `${v} bpm`; if (state.ppg) state.ppg.bpm = +v; });
bind('#walk', v => { $('#walkOut').textContent = `${v} passos/min`; state.walk = +v; });
bind('#bat', v => { $('#batOut').textContent = `${(+v).toFixed(2).replace('.', ',')} V`; if (state.mcu) state.mcu.analog[0] = v / 2; });
$('#finger').onchange = e => { if (state.ppg) state.ppg.finger = e.target.checked; };
$('#gerbers').onclick = () => { if (!state.design) return; const z = fabricationZip(state.design, RULES, 'HS-1'); const url = URL.createObjectURL(new Blob([z], { type: 'application/zip' })); const a = Object.assign(document.createElement('a'), { href: url, download: 'relogio-hs1-fabricacao.zip' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
boot().then(() => { state.ppg.bpm = +$('#bpm').value; state.mcu.analog[0] = $('#bat').value / 2; }); board();
