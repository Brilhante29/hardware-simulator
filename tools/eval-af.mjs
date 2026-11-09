#!/usr/bin/env node
// Avalia o detector de FA do firmware examples/firmware/pulseira-avc rodando no ATmega328P emulado: janelas de 40 s com
// ritmo sinusal (50–110 bpm) ou FA (70–140 bpm), sementes diferentes; conta acertos e erros como num teste diagnóstico.
// Uso: node tools/eval-af.mjs [janelas por classe=12] [paralelo=4]
import { readFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createMcu } from '../src/emulator/avr.mjs';
import { Gc9a01, Max30102, Mpu6050 } from '../src/emulator/devices.mjs';

const HEX = new URL('../examples/firmware/pulseira-avc/pulseira-avc-nano.hex', import.meta.url);
function window({ rhythm, bpm, seed, seconds = 40 }) {
  const m = createMcu(readFileSync(HEX, 'utf8')); let out = ''; m.onSerial = b => { out += String.fromCharCode(b); };
  m.attachPinDevice('D10', new Gc9a01({ cs: 'D10', dc: 'D9', rst: 'D8' })); m.attachI2C(0x57, new Max30102({ bpm, rhythm, seed })); m.attachI2C(0x68, new Mpu6050()); m.setInput('D2', 1);
  m.runSeconds(seconds);
  const last = out.trim().split('\n').filter(l => l.startsWith('{"t"')).map(l => JSON.parse(l)).at(-1);
  return { rhythm, bpm, seed, af: !!last?.af, irr: last?.irr, hr: last?.hr };
}
if (!isMainThread) { parentPort.postMessage(workerData.map(window)); }
else {
  const per = Number(process.argv[2] || 12), par = Number(process.argv[3] || 4), cases = [];
  let s = 1; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < per; i++) cases.push({ rhythm: 'sinus', bpm: Math.round(50 + 60 * r()), seed: 100 + i }, { rhythm: 'af', bpm: Math.round(70 + 70 * r()), seed: 200 + i });
  const chunks = Array.from({ length: par }, (_, k) => cases.filter((_, i) => i % par === k));
  const t = performance.now();
  const res = (await Promise.all(chunks.map(c => new Promise((ok, no) => { const w = new Worker(new URL(import.meta.url), { workerData: c }); w.on('message', ok); w.on('error', no); })))).flat();
  const tp = res.filter(x => x.rhythm === 'af' && x.af).length, fn = res.filter(x => x.rhythm === 'af' && !x.af).length, tn = res.filter(x => x.rhythm === 'sinus' && !x.af).length, fp = res.filter(x => x.rhythm === 'sinus' && x.af).length;
  for (const x of res) console.log(`${x.rhythm.padEnd(5)} ${String(x.bpm).padStart(3)} bpm  irr=${x.irr?.toFixed(3)}  hr=${x.hr}  ${x.af ? 'FA' : '—'}`);
  console.log(JSON.stringify({ janelas: res.length, sensibilidade: tp / (tp + fn), especificidade: tn / (tn + fp), tp, fn, tn, fp, segundos: +((performance.now() - t) / 1000).toFixed(1) }));
}
