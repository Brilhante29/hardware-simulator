#!/usr/bin/env node
// Dá boot num firmware do Arduino Uno (Intel HEX gerado pelo PlatformIO/Arduino) e mostra a serial no terminal.
// Uso:  node tools/avr-run.mjs .pio/build/uno/firmware.hex [--seconds 5] [--pins] [--baud-ignored]
//  - sem --seconds roda em tempo real até Ctrl+C; o que você digitar vai para a serial do Uno.
//  - --pins mostra cada mudança de pino com o instante simulado.
import { readFileSync } from 'node:fs';
import { ATmega328P, CLOCK } from '../src/emulator/avr.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('Uso: node tools/avr-run.mjs caminho/firmware.hex [--seconds N] [--pins]'); process.exit(2); }
const seconds = args.includes('--seconds') ? Number(args[args.indexOf('--seconds') + 1]) : null;
const showPins = args.includes('--pins');

let mcu;
try { mcu = new ATmega328P(readFileSync(file, 'utf8')); } catch (e) { console.error(`Não foi possível carregar ${file}: ${e.message}`); process.exit(1); }
mcu.onSerial = b => process.stdout.write(String.fromCharCode(b));
if (showPins) mcu.onPinChange = (changed, t) => {
  const list = Object.entries(changed).map(([k, p]) => `${k}=${p.mode === 'output' ? (p.duty !== null && p.duty !== 0 && p.duty !== 1 ? `PWM ${(p.duty * 100).toFixed(0)}%` : p.level ? 'HIGH' : 'LOW') : p.mode}`).join(' ');
  process.stderr.write(`\x1b[2m[${t.toFixed(4)} s] ${list}\x1b[0m\n`);
};
process.stderr.write(`\x1b[36m▶ Uno (ATmega328P @ 16 MHz) · ${file} · ${mcu.programSize} bytes\x1b[0m\n`);

if (seconds !== null) {
  mcu.runSeconds(seconds);
  process.stderr.write(`\n\x1b[36m■ ${mcu.time.toFixed(3)} s simulados\x1b[0m\n`);
  process.exit(mcu.halted ? 1 : 0);
}
// Tempo real: avança o relógio do chip junto com o relógio da parede.
const start = performance.now();
if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
process.stdin.on('data', d => mcu.serialInput(d.toString()));
setInterval(() => {
  const target = (performance.now() - start) / 1000 * CLOCK;
  const behind = target - mcu.cycles;
  if (behind > 0) mcu.run(Math.min(behind, CLOCK / 10));
}, 10);
process.on('SIGINT', () => { process.stderr.write(`\n\x1b[36m■ ${mcu.time.toFixed(2)} s simulados\x1b[0m\n`); process.exit(0); });
