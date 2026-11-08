#!/usr/bin/env node
// Dá boot num firmware do Arduino Uno ou Mega 2560 (Intel HEX gerado pelo PlatformIO/Arduino) e mostra a serial no terminal.
// Uso:  node tools/avr-run.mjs .pio/build/uno/firmware.hex [--mcu auto|atmega328p|atmega2560] [--seconds 5] [--pins] [--lcd] [--oled] [--eeprom arquivo.bin]
//  - --mcu: sem ele o chip sai da tabela de vetores do .hex (26 vetores no Uno, 57 no Mega).
//  - no Mega, Serial1..Serial3 aparecem no terminal com o prefixo [Serial1] etc.
//  - sem --seconds roda em tempo real até Ctrl+C; o que você digitar vai para a serial do Uno.
//  - --pins mostra cada mudança de pino com o instante simulado.
//  - --lcd liga um LCD 16×2 I²C (0x27) e mostra a tela quando ela muda; --lcd-par liga um LCD direto nos pinos
//    (LiquidCrystal lcd(12, 11, 5, 4, 3, 2)); --oled liga um SSD1306 (0x3C) e desenha no fim.
//  - --sonar 120 liga um HC-SR04 com TRIG no D9 e ECHO no D10, com o obstáculo a 120 cm.
//  - --eeprom guarda a EEPROM do chip num arquivo entre execuções.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createMcu, CLOCK } from '../src/emulator/avr.mjs';
import { LcdI2C, LcdParallel, HcSr04, Ssd1306 } from '../src/emulator/devices.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('Uso: node tools/avr-run.mjs caminho/firmware.hex [--mcu auto|atmega328p|atmega2560] [--seconds N] [--pins]'); process.exit(2); }
const chip = args.includes('--mcu') ? args[args.indexOf('--mcu') + 1] : 'auto';
const seconds = args.includes('--seconds') ? Number(args[args.indexOf('--seconds') + 1]) : null;
const showPins = args.includes('--pins');
const eepromFile = args.includes('--eeprom') ? args[args.indexOf('--eeprom') + 1] : null;

let mcu;
try { mcu = createMcu(readFileSync(file, 'utf8'), chip); } catch (e) { console.error(`Não foi possível carregar ${file}: ${e.message}`); process.exit(1); }
const extra = [[], [], [], []]; // Serial1..3 do Mega, por linha
mcu.onSerial = (b, i = 0) => {
  if (!i) { process.stdout.write(Buffer.from([b])); return; }
  if (b === 10) { process.stderr.write(`\x1b[33m[Serial${i}]\x1b[0m ${Buffer.from(extra[i]).toString('utf8').replace(/\r$/, '')}\n`); extra[i] = []; } else extra[i].push(b);
};
const lcd = args.includes('--lcd-par') ? mcu.attachPinDevice('D11', new LcdParallel()) : args.includes('--lcd') ? mcu.attachI2C(0x27, new LcdI2C()) : null;
const oled = args.includes('--oled') ? mcu.attachI2C(0x3c, new Ssd1306()) : null;
if (args.includes('--sonar')) mcu.attachPinDevice('D9', new HcSr04({ echo: 'D10', distanceCm: Number(args[args.indexOf('--sonar') + 1]) || 100 }));
if (eepromFile && existsSync(eepromFile)) mcu.eeprom.set(readFileSync(eepromFile).subarray(0, mcu.eeprom.length));
const saveEeprom = () => { if (eepromFile) writeFileSync(eepromFile, Buffer.from(mcu.eeprom)); };
let lastLcd = '';
const showLcd = () => { if (!lcd) return; const now = lcd.lines().join('|'); if (now === lastLcd) return; lastLcd = now; process.stderr.write(`\x1b[32m┌────────────────┐\n${lcd.lines().map(l => '│' + l + '│').join('\n')}\n└────────────────┘ t=${mcu.time.toFixed(2)} s\x1b[0m\n`); };
const showOled = () => { if (oled) process.stderr.write('\x1b[36m' + oled.ascii(2) + '\x1b[0m\n'); };
if (showPins) mcu.onPinChange = (changed, t) => {
  const list = Object.entries(changed).map(([k, p]) => `${k}=${p.mode === 'output' ? (p.duty !== null && p.duty !== 0 && p.duty !== 1 ? `PWM ${(p.duty * 100).toFixed(0)}%` : p.level ? 'HIGH' : 'LOW') : p.mode}`).join(' ');
  process.stderr.write(`\x1b[2m[${t.toFixed(4)} s] ${list}\x1b[0m\n`);
};
process.stderr.write(`\x1b[36m▶ ${mcu.chip.board} (${mcu.chip.name} @ 16 MHz) · ${file} · ${mcu.programSize} bytes\x1b[0m\n`);

if (seconds !== null) {
  for (let t = 0; t < seconds; t += 0.05) { mcu.runSeconds(Math.min(0.05, seconds - t)); showLcd(); }
  showOled(); saveEeprom();
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
  showLcd();
}, 10);
process.on('SIGINT', () => { showOled(); saveEeprom(); process.stderr.write(`\n\x1b[36m■ ${mcu.time.toFixed(2)} s simulados\x1b[0m\n`); process.exit(0); });
