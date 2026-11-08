// Emulador AVR de 8 bits escrito para o Hardware Studio: ATmega328P (Arduino Uno) e ATmega2560 (Arduino Mega 2560).
// Referências: Microchip "AVR Instruction Set Manual" (DS40002198), datasheet ATmega328P (DS40002061) e
// datasheet ATmega640/1280/1281/2560/2561 (Atmel 2549Q). Os dois chips usam o mesmo núcleo; o que muda vem da
// descrição do chip (CHIPS): memórias, portas, timers de 16 bits, USARTs, interrupções externas, PCINT e vetores.
// No 2560 o PC tem 17 bits (3 bytes na pilha, CALL/RET com 1 ciclo a mais), há EIJMP/EICALL (EIND) e ELPM (RAMPZ).
// Periféricos: GPIO com pull-up, Timer0/2 (8 bits) e Timer1/3/4/5 (16 bits, PWM, CTC, captura), USART (assíncrono,
// síncrono e MSPIM), ADC com referências, comparador, EEPROM, INTn, PCINT, watchdog, sleep, SPI e TWI mestre/escravo.

export const CLOCK = 16_000_000;
const SREG = 0x5f, SPL = 0x5d, SPH = 0x5e, RAMPZ = 0x5b, EIND = 0x5c;
const C = 0, Z = 1, N = 2, V = 3, S = 4, H = 5, T = 6, I = 7;
// Vetores de interrupção (número do vetor; endereço em palavras = número × 2).
export const VEC = { INT0: 1, INT1: 2, PCINT0: 3, PCINT1: 4, PCINT2: 5, WDT: 6, TIMER2_COMPA: 7, TIMER2_COMPB: 8, TIMER2_OVF: 9, TIMER1_CAPT: 10, TIMER1_COMPA: 11, TIMER1_COMPB: 12, TIMER1_OVF: 13, TIMER0_COMPA: 14, TIMER0_COMPB: 15, TIMER0_OVF: 16, SPI_STC: 17, USART_RX: 18, USART_UDRE: 19, USART_TX: 20, ADC: 21, EE_READY: 22, ANALOG_COMP: 23, TWI: 24, SPM_READY: 25 };
// Tabela 14-1 do datasheet do 2560 (lá numerada a partir de 1; aqui a partir de 0, como no 328P).
export const VEC_2560 = { INT0: 1, INT1: 2, INT2: 3, INT3: 4, INT4: 5, INT5: 6, INT6: 7, INT7: 8, PCINT0: 9, PCINT1: 10, PCINT2: 11, WDT: 12, TIMER2_COMPA: 13, TIMER2_COMPB: 14, TIMER2_OVF: 15, TIMER1_CAPT: 16, TIMER1_COMPA: 17, TIMER1_COMPB: 18, TIMER1_COMPC: 19, TIMER1_OVF: 20, TIMER0_COMPA: 21, TIMER0_COMPB: 22, TIMER0_OVF: 23, SPI_STC: 24, USART0_RX: 25, USART0_UDRE: 26, USART0_TX: 27, ANALOG_COMP: 28, ADC: 29, EE_READY: 30, TIMER3_CAPT: 31, TIMER3_COMPA: 32, TIMER3_COMPB: 33, TIMER3_COMPC: 34, TIMER3_OVF: 35, USART1_RX: 36, USART1_UDRE: 37, USART1_TX: 38, TWI: 39, SPM_READY: 40, TIMER4_CAPT: 41, TIMER4_COMPA: 42, TIMER4_COMPB: 43, TIMER4_COMPC: 44, TIMER4_OVF: 45, TIMER5_CAPT: 46, TIMER5_COMPA: 47, TIMER5_COMPB: 48, TIMER5_COMPC: 49, TIMER5_OVF: 50, USART2_RX: 51, USART2_UDRE: 52, USART2_TX: 53, USART3_RX: 54, USART3_UDRE: 55, USART3_TX: 56 };

export function parseHex(text, capacity = 262144) {
  const flash = new Uint8Array(capacity); let max = 0, base = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line[0] !== ':') throw new Error('Arquivo .hex inválido');
    const bytes = line.slice(1).match(/../g).map(h => parseInt(h, 16));
    const sum = bytes.reduce((a, b) => a + b, 0) & 0xff; if (sum !== 0) throw new Error('Checksum inválido no .hex');
    const [len, hi, lo, type] = bytes, addr = (hi << 8) | lo, data = bytes.slice(4, 4 + len);
    if (type === 0) { data.forEach((b, i) => { const a = base + addr + i; if (a < flash.length) flash[a] = b; }); max = Math.max(max, base + addr + len); }
    else if (type === 1) break;
    else if (type === 2) base = ((data[0] << 8) | data[1]) << 4;
    else if (type === 4) base = ((data[0] << 8) | data[1]) << 16;
  }
  if (!max) throw new Error('O .hex não tem dados');
  return { flash, size: max };
}

// Pinos do Uno → porta/bit.
export const UNO_PINS = Object.fromEntries([
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(b => [`D${b}`, ['D', b]]),
  ...[0, 1, 2, 3, 4, 5].map(b => [`D${b + 8}`, ['B', b]]),
  ...[0, 1, 2, 3, 4, 5].map(b => [`A${b}`, ['C', b]]),
]);
// Pinos do Mega 2560 (variante "mega" do núcleo Arduino: pins_arduino.h).
const MEGA_D = ['E0', 'E1', 'E4', 'E5', 'G5', 'E3', 'H3', 'H4', 'H5', 'H6', 'B4', 'B5', 'B6', 'B7', 'J1', 'J0', 'H1', 'H0', 'D3', 'D2', 'D1', 'D0',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'C7', 'C6', 'C5', 'C4', 'C3', 'C2', 'C1', 'C0', 'D7', 'G2', 'G1', 'G0',
  'L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1', 'L0', 'B3', 'B2', 'B1', 'B0'];
export const MEGA_PINS = Object.fromEntries([
  ...MEGA_D.map((pb, i) => [`D${i}`, [pb[0], +pb[1]]]),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(b => [`A${b}`, ['F', b]]),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(b => [`A${b + 8}`, ['K', b]]),
]);
const PRE = [0, 1, 8, 64, 256, 1024, 0, 0], PRE2 = [0, 1, 8, 32, 64, 128, 256, 1024];
const bits = (port, list = [0, 1, 2, 3, 4, 5, 6, 7]) => list.map(b => `P${port}${b}`);

export const CHIPS = {
  atmega328p: {
    id: 'atmega328p', name: 'ATmega328P', board: 'Arduino Uno', flashWords: 16384, dataSize: 0x900, ioEnd: 0x100, eeprom: 1024, pc22: false,
    ports: { B: 0x23, C: 0x26, D: 0x29 }, pins: UNO_PINS,
    pwm: { D6: ['t0', 'A'], D5: ['t0', 'B'], D9: ['t1', 'A'], D10: ['t1', 'B'], D11: ['t2', 'A'], D3: ['t2', 'B'] },
    timers16: [{ id: 't1', base: 0x80, tifr: 0x36, timsk: 0x6f, icp: 'PB0', ch: 'AB', vec: { CAPT: 10, COMPA: 11, COMPB: 12, OVF: 13 } }],
    usarts: [{ base: 0xc0, vec: { RX: 18, UDRE: 19, TX: 20 } }],
    ints: ['PD2', 'PD3'], pcint: [bits('B'), bits('C'), bits('D')],
    vec: { INT: [1, 2], PCINT: [3, 4, 5], WDT: 6, T2: [7, 8, 9], T0: [14, 15, 16], SPI: 17, ADC: 21, EE: 22, AC: 23, TWI: 24 },
    ain: ['PD6', 'PD7'], ss: 'PB2', adc: 8, refs: [null, 5, 5, 1.1],
    power: { active: 10.4, idle: 2.4, deepWdt: 0.0042, deep: 0.0001, source: 'ATmega328P DS40002061 Tabela 32-4 (5 V; ativo/idle de 8 MHz × 2)' },
  },
  atmega2560: {
    id: 'atmega2560', name: 'ATmega2560', board: 'Arduino Mega 2560', flashWords: 131072, dataSize: 0x2200, ioEnd: 0x200, eeprom: 4096, pc22: true,
    ports: { A: 0x20, B: 0x23, C: 0x26, D: 0x29, E: 0x2c, F: 0x2f, G: 0x32, H: 0x100, J: 0x103, K: 0x106, L: 0x109 }, pins: MEGA_PINS,
    pwm: { D2: ['t3', 'B'], D3: ['t3', 'C'], D4: ['t0', 'B'], D5: ['t3', 'A'], D6: ['t4', 'A'], D7: ['t4', 'B'], D8: ['t4', 'C'], D9: ['t2', 'B'], D10: ['t2', 'A'], D11: ['t1', 'A'], D12: ['t1', 'B'], D13: ['t0', 'A'], D44: ['t5', 'C'], D45: ['t5', 'B'], D46: ['t5', 'A'] },
    timers16: [
      { id: 't1', base: 0x80, tifr: 0x36, timsk: 0x6f, icp: 'PD4', ch: 'ABC', vec: { CAPT: 16, COMPA: 17, COMPB: 18, COMPC: 19, OVF: 20 } },
      { id: 't3', base: 0x90, tifr: 0x38, timsk: 0x71, icp: 'PE7', ch: 'ABC', vec: { CAPT: 31, COMPA: 32, COMPB: 33, COMPC: 34, OVF: 35 } },
      { id: 't4', base: 0xa0, tifr: 0x39, timsk: 0x72, icp: 'PL0', ch: 'ABC', vec: { CAPT: 41, COMPA: 42, COMPB: 43, COMPC: 44, OVF: 45 } },
      { id: 't5', base: 0x120, tifr: 0x3a, timsk: 0x73, icp: 'PL1', ch: 'ABC', vec: { CAPT: 46, COMPA: 47, COMPB: 48, COMPC: 49, OVF: 50 } },
    ],
    usarts: [{ base: 0xc0, vec: { RX: 25, UDRE: 26, TX: 27 } }, { base: 0xc8, vec: { RX: 36, UDRE: 37, TX: 38 } }, { base: 0xd0, vec: { RX: 51, UDRE: 52, TX: 53 } }, { base: 0x130, vec: { RX: 54, UDRE: 55, TX: 56 } }],
    ints: ['PD0', 'PD1', 'PD2', 'PD3', 'PE4', 'PE5', 'PE6', 'PE7'], pcint: [bits('B'), ['PE0', ...bits('J', [0, 1, 2, 3, 4, 5, 6])], bits('K')],
    vec: { INT: [1, 2, 3, 4, 5, 6, 7, 8], PCINT: [9, 10, 11], WDT: 12, T2: [13, 14, 15], T0: [21, 22, 23], SPI: 24, AC: 28, ADC: 29, EE: 30, TWI: 39 },
    ain: ['PE2', 'PE3'], ss: 'PB0', adc: 16, refs: [null, 5, 1.1, 2.56],
    power: { active: 20, idle: 5.4, deepWdt: 0.005, deep: 0.001, source: 'ATmega2560 Atmel 2549Q §31.1 (5 V; ativo/idle de 8 MHz × 2; power-down pelos limites "<" a 3 V)' },
  },
};

// Os vetores do 2560 vão até o 56; o 328P tem 26. O avr-gcc preenche todos com JMP, então a tabela denuncia o chip.
export function detectChip(hex) {
  const { flash, size } = typeof hex === 'string' ? parseHex(hex) : hex;
  if (size > 32768) return 'atmega2560';
  let jumps = 0; while (jumps < 57 && (((flash[jumps * 4] | (flash[jumps * 4 + 1] << 8)) & 0xfe0e) === 0x940c)) jumps++;
  return jumps >= 57 ? 'atmega2560' : 'atmega328p';
}

export class AVR {
  constructor(hex, chip) {
    this.chip = chip;
    const { flash, size } = typeof hex === 'string' ? parseHex(hex) : hex, bytes = chip.flashWords * 2;
    if (size > bytes) throw new Error(`O firmware tem ${size} bytes e não cabe nos ${bytes / 1024} KB de flash do ${chip.name}`);
    this.flashBytes = new Uint8Array(bytes); this.flashBytes.set(flash.subarray(0, Math.min(flash.length, bytes))); this.programSize = size;
    this.flashMask = bytes - 1; this.pcMask = chip.flashWords - 1; this.pcExtra = chip.pc22 ? 1 : 0;
    this.prog = new Uint16Array(chip.flashWords);
    for (let i = 0; i < chip.flashWords; i++) this.prog[i] = this.flashBytes[2 * i] | (this.flashBytes[2 * i + 1] << 8);
    this.data = new Uint8Array(chip.dataSize); this.ramEnd = chip.dataSize - 1; this.ioEnd = chip.ioEnd;
    this.pins = chip.pins; this.ports = {}; this.portByPinAddr = {}; this.pinName = {}; this.inputs = {};
    for (const [n, base] of Object.entries(chip.ports)) {
      const p = this.ports[n] = { name: n, pin: base, ddr: base + 1, port: base + 2 }; this.portByPinAddr[base] = p; this.inputs[n] = new Array(8).fill(null);
      for (let b = 0; b < 8; b++) this.pinName[n + b] = `P${n}${b}`;
    }
    for (const [name, [port, bit]] of Object.entries(this.pins)) this.pinName[port + bit] = name;
    this.timers16 = chip.timers16.map(t => ({ ...t, icp: this.ref(t.icp) })); this.t16 = Object.fromEntries(this.timers16.map(t => [t.id, t]));
    this.ints = chip.ints.map(r => this.ref(r)); this.intByPort = {}; this.ints.forEach(([port, bit], n) => (this.intByPort[port] ||= []).push([bit, n]));
    this.pcByPort = {}; chip.pcint.forEach((g, gi) => g.forEach((r, i) => { const [port, bit] = this.ref(r); (this.pcByPort[port] ||= []).push([bit, gi, i]); }));
    this.ainPorts = {}; for (const r of chip.ain) { const [port, bit] = this.ref(r); this.ainPorts[port] = (this.ainPorts[port] || 0) | (1 << bit); }
    this.onSerial = null; this.onPinChange = null;
    this.analog = new Array(chip.adc).fill(0); // volts nas entradas A0..A7 (A0..A15 no Mega)
    this.analogPins = {}; // volts em AIN0/AIN1 para o comparador (ou AREF)
    this.eeprom = new Uint8Array(chip.eeprom).fill(0xff); // sobrevive a reset, como a EEPROM real
    this.i2c = new Map(); this.spiDevice = null; this.onReset = null; this.onEeprom = null; this.pinDevices = new Map();
    // Campos preenchidos depois existem desde já: o objeto não muda de forma e o código quente segue rápido no V8.
    this.temp16 = null; this.i2cPeers = null; this.mspimDevice = null; this.mspimDevices = null; this.out = ''; this.outs = null;
    this.buildIo(); this.buildInterrupts();
    this.cycles = 0; this.reset('power');
  }
  // 'D13', 'A0' ou 'PB7' → [porta, bit].
  ref(name) { const p = this.pins[name]; if (p) return p; const m = /^P([A-L])([0-7])$/.exec(name); if (m && this.ports[m[1]]) return [m[1], +m[2]]; throw new Error(`Pino desconhecido no ${this.chip.name}: ${name}`); }
  levelOf(name) { const [port, bit] = this.ref(name); return (this.readPin(this.ports[port].pin) >> bit) & 1; }
  // Dispositivos de um fio (DHT…): recebem as mudanças que o chip faz no pino e respondem com eventos agendados.
  attachPinDevice(pin, device) { this.pinDevices.set(pin, device); device.attach?.(this, pin); return device; }
  schedule(atCycle, fn) { this.events.push({ at: atCycle, fn }); this.events.sort((a, b) => a.at - b.at); this.nextEventAt = this.events[0].at; }
  runEvents() { while (this.events.length && this.events[0].at <= this.cycles) this.events.shift().fn(); this.nextEventAt = this.events.length ? this.events[0].at : Infinity; }
  notifyPinDevices() {
    for (const [pin, dev] of this.pinDevices) {
      const [port, bit] = this.ref(pin), p = this.ports[port], output = !!((this.data[p.ddr] >> bit) & 1), level = (this.data[p.port] >> bit) & 1, key = output * 2 + level;
      if (this.driveKeys[pin] !== key) { this.driveKeys[pin] = key; dev.onDrive?.({ output, level }); }
    }
  }
  attachI2C(address, device) { this.i2c.set(address & 0x7f, device); device.attach?.(this); return device; }
  reset(kind = 'external') {
    this.data.fill(0); this.pc = 0; this.halted = false; this.lastError = null;
    if (kind === 'power') this.cycles = 0;
    this.timerSync = this.cycles;
    this.data[0x54] = kind === 'power' ? 0x01 : kind === 'wdt' ? 0x08 : 0x02; // MCUSR: PORF / WDRF / EXTRF
    this.ee = { busyUntil: 0, mpeUntil: -1 };
    this.wdt = { last: this.cycles, ceUntil: -1 };
    this.spi = { doneAt: -1, rx: 0xff, flagSeen: false };
    this.twi = { doneAt: -1, apply: null, phase: 'idle', device: null, read: false };
    this.sleeping = false; this.pulses = {}; this.acPrev = null; this.energy = { active: 0, idle: 0, deep: 0, wdt: 0, mark: this.cycles }; this.events = []; this.nextEventAt = Infinity; this.driveKeys = {};
    this.sp = this.ramEnd; this.interruptDelay = 0; this.irqCheckAt = 0;
    this.t0 = { acc: 0, flags: 0 }; this.t2 = { acc: 0, dir: 1 };
    for (const tm of this.timers16) tm.st = { acc: 0, dir: 1 };
    this.t1 = this.t16.t1.st;
    this.uarts = this.chip.usarts.map(u => { this.data[u.base] = 0x20; return { base: u.base, busyUntil: 0, pending: null, txc: false, txcLatched: false, rx: [], rxNextAt: 0, rxData: 0, rxReady: false }; }); // UDREn vazio
    this.uart = this.uarts[0];
    this.adc = { doneAt: -1 };
    this.lastPins = this.pinSnapshot(); this.prevLevels = this.portLevels();
    if (kind !== 'power') this.onReset?.(kind);
  }
  get sp() { return this.data[SPL] | (this.data[SPH] << 8); }
  set sp(v) { this.data[SPL] = v & 0xff; this.data[SPH] = (v >> 8) & 0xff; }

  // ---------- memória de dados com periféricos ----------
  // Cada registrador de E/S com efeito colateral tem um tratador; o resto é memória comum.
  buildIo() {
    const R = this.rh = new Array(this.ioEnd).fill(null), W = this.wh = new Array(this.ioEnd).fill(null), d = this.data;
    const syncRead = a => { this.syncTimers(); return d[a]; };
    for (const p of Object.values(this.ports)) {
      R[p.pin] = a => this.readPin(a);
      W[p.pin] = (a, v) => { d[a + 2] ^= v; this.pinsChanged(); }; // PINx: escrever 1 alterna PORTx
      W[p.ddr] = W[p.port] = (a, v) => { d[a] = v; this.pinsChanged(); };
    }
    for (const tifr of [0x35, 0x37, ...this.timers16.map(t => t.tifr)]) { R[tifr] = syncRead; W[tifr] = (a, v) => { this.syncTimers(); d[a] &= ~v; }; } // escrever 1 limpa a flag
    R[0x46] = R[0xb2] = syncRead; W[0x46] = W[0xb2] = (a, v) => { this.syncTimers(); d[a] = v; };
    W[0x44] = W[0x45] = W[0xb0] = W[0xb1] = (a, v) => { this.syncTimers(); d[a] = v; this.pinsChanged(); };
    W[0x47] = W[0x48] = W[0xb3] = W[0xb4] = (a, v) => { d[a] = v; this.pinsChanged(); };
    // Registradores de 16 bits usam o registrador TEMP: o byte alto é escrito primeiro e lido depois do baixo.
    for (const { base: b, ch } of this.timers16) {
      W[b] = W[b + 1] = (a, v) => { this.syncTimers(); d[a] = v; this.pinsChanged(); };
      const lows = [6, 8, 10, ...(ch.includes('C') ? [12] : [])].map(o => b + o);
      for (const lo of [b + 4, ...lows]) { R[lo + 1] = a => this.temp16 ?? d[a]; W[lo + 1] = (a, v) => { this.temp16 = v; }; }
      R[b + 4] = a => { this.syncTimers(); this.temp16 = d[a + 1]; return d[a]; };
      W[b + 4] = (a, v) => { this.syncTimers(); d[a + 1] = this.temp16 ?? 0; d[a] = v; };
      for (const lo of lows) { R[lo] = a => { this.temp16 = d[a + 1]; return d[a]; }; W[lo] = (a, v) => { d[a + 1] = this.temp16 ?? 0; d[a] = v; this.pinsChanged(); }; }
    }
    this.chip.usarts.forEach(({ base: b }, i) => {
      R[b] = () => { this.syncUart(i); const u = this.uarts[i]; return (d[b] & 0x1f) | (u.pending === null ? 0x20 : 0) | (u.txc ? 0x40 : 0) | (u.rxReady ? 0x80 : 0); };
      R[b + 6] = () => { this.syncUart(i); const u = this.uarts[i]; u.rxReady = false; return u.rxData; };
      W[b] = (a, v) => { this.syncUart(i); if (v & 0x40) this.uarts[i].txc = false; d[b] = (d[b] & ~0x03) | (v & 0x03); };
      W[b + 6] = (a, v) => this.uartWrite(v, i);
    });
    R[0x7a] = () => { this.syncAdc(); return d[0x7a]; };
    W[0x7a] = (a, v) => {
      this.syncAdc(); const old = d[0x7a];
      const flag = (old & 0x10) && !(v & 0x10) ? 0x10 : 0; // escrever 1 em ADIF limpa
      d[0x7a] = (v & ~0x10) | flag;
      if ((v & 0x40) && !(old & 0x40)) this.adcStart();
    };
    R[0x3f] = () => { this.syncEeprom(); return d[0x3f]; }; W[0x3f] = (a, v) => this.eepromControl(v);
    R[0x4d] = () => { this.syncSpi(); if (d[0x4d] & 0x80) this.spi.flagSeen = true; return d[0x4d]; };
    R[0x4e] = () => { this.syncSpi(); if (this.spi.flagSeen) { d[0x4d] &= ~0x80; this.spi.flagSeen = false; } return d[0x4e]; };
    W[0x4e] = (a, v) => this.spiWrite(v);
    R[0xb9] = R[0xbb] = R[0xbc] = a => { this.syncTwi(); return d[a]; }; W[0xbc] = (a, v) => this.twiControl(v);
    R[0x60] = () => { this.syncWdt(); return d[0x60]; }; W[0x60] = (a, v) => this.wdtWrite(v);
    R[0x50] = () => { this.syncComparator(); return d[0x50]; };
    W[0x50] = (a, v) => { this.syncComparator(); d[0x50] = (v & 0xcf) | (d[0x50] & 0x20) | (d[0x50] & 0x10 & ~(v & 0x10)); this.acPrev = null; this.syncComparator(); };
    W[0x3c] = W[0x3b] = (a, v) => { d[a] &= ~v; }; // EIFR/PCIFR: escrever 1 limpa
  }
  read(addr) {
    addr &= 0xffff;
    if (addr < this.ioEnd) { const h = this.rh[addr]; if (h) return h(addr); } else if (addr > this.ramEnd) return 0;
    return this.data[addr];
  }
  write(addr, v) {
    addr &= 0xffff; v &= 0xff;
    if (addr < this.ioEnd) { if (addr >= 0x20) this.irqCheckAt = 0; const h = this.wh[addr]; if (h) { h(addr, v); return; } }
    else if (addr > this.ramEnd) return;
    this.data[addr] = v;
  }
  readPin(pinAddr) {
    const p = this.portByPinAddr[pinAddr], ext = this.inputs[p.name];
    const ddr = this.data[p.ddr], port = this.data[p.port]; let value = 0;
    for (let b = 0; b < 8; b++) {
      let level;
      if (ddr & (1 << b)) level = (port >> b) & 1;
      else { const e = ext[b]; level = e === null ? ((port >> b) & 1) : e ? 1 : 0; } // flutuante com pull-up lê 1
      value |= level << b;
    }
    return value;
  }
  setInput(pinName, level) { const [port, bit] = this.ref(pinName); const v = level === null || level === undefined ? null : level ? 1 : 0; if (this.inputs[port][bit] === v) return; this.inputs[port][bit] = v; this.pinsChanged(); }
  wsFlush(p) {
    if (p.bits.length >= 24) { const bytes = []; for (let i = 0; i + 8 <= p.bits.length; i += 8) bytes.push(p.bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0)); const px = []; for (let i = 0; i + 3 <= bytes.length; i += 3) px.push([bytes[i + 1], bytes[i], bytes[i + 2]]); p.frame = px; p.frames = (p.frames || 0) + 1; }
    p.bits = [];
  }
  // Cores do último quadro WS2812 (NeoPixel, ordem GRB no fio) enviado pelo pino: [[r,g,b], ...].
  neopixel(pin) { const p = this.pulses[pin]; if (!p) return null; if (p.bits.length && this.cycles - p.fall > 800) this.wsFlush(p); return p.frame; }
  // ---------- comparador analógico ----------
  pinVolts(pin) { if (this.analogPins[pin] !== undefined) return this.analogPins[pin]; return this.levelOf(pin) * 5; }
  setAnalogPin(pin, volts) { this.analogPins[pin] = volts; this.syncComparator(); this.irqCheckAt = 0; }
  syncComparator() {
    const a = this.data[0x50]; if (a & 0x80) return; // ACD: desligado
    const [ain0, ain1] = this.chip.ain, name = r => { const [port, bit] = this.ref(r); return this.pinName[port + bit]; };
    const pos = (a & 0x40) ? 1.1 : this.pinVolts(name(ain0));
    const muxed = (this.data[0x7b] & 0x40) && !(this.data[0x7a] & 0x80);
    const neg = muxed ? this.muxVolts() : this.pinVolts(name(ain1));
    const aco = pos > neg ? 1 : 0;
    if (this.acPrev !== null && aco !== this.acPrev) { const mode = a & 3; if (mode === 0 || (mode === 2 && !aco) || (mode === 3 && aco)) this.data[0x50] |= 0x10; }
    this.acPrev = aco; this.data[0x50] = (this.data[0x50] & ~0x20) | (aco << 5);
  }
  // ---------- consumo (tabelas DC do datasheet; 16 MHz extrapolado de 8 MHz) ----------
  powerUsage() {
    const e = this.energy, s = c => c / CLOCK, wdtOn = (this.data[0x60] & 0x48) ? 1 : 0, p = this.chip.power;
    const mA = { active: p.active, idle: p.idle, deep: wdtOn ? p.deepWdt : p.deep };
    const total = s(e.active) * mA.active + s(e.idle) * mA.idle + s(e.deep) * mA.deep, time = s(e.active + e.idle + e.deep);
    return { averageMa: time ? total / time : 0, mAh: total / 3600, activeShare: time ? s(e.active) / time : 1, source: p.source };
  }
  // Frequência e largura de pulso medidas no pino (para servo, tone e PWM por software).
  pulseInfo(pin) { const p = this.pulses[pin]; if (!p || p.last === undefined || this.cycles - p.last > CLOCK / 4) return null; return { highUs: p.high / 16, periodUs: p.period / 16, hz: p.period ? CLOCK / p.period : 0 }; }

  pinSnapshot() {
    const out = {}, pwmMap = this.chip.pwm;
    for (const name in this.pins) {
      const [port, bit] = this.pins[name], p = this.ports[port], out_ = (this.data[p.ddr] >> bit) & 1, lvl = (this.data[p.port] >> bit) & 1;
      let duty = null; const pwm = pwmMap[name];
      if (pwm && out_) duty = this.pwmDuty(pwm[0], pwm[1]);
      out[name] = { mode: out_ ? 'output' : lvl ? 'input_pullup' : 'input', level: duty !== null ? (duty > 0 ? 1 : 0) : lvl, duty: duty !== null ? duty : (out_ ? lvl : null) };
    }
    return out;
  }
  pwmDuty(timer, ch) {
    const d = this.data;
    if (timer === 't0' || timer === 't2') {
      const regs = timer === 't0' ? [0x44, 0x47, 0x48] : [0xb0, 0xb3, 0xb4];
      const tccrA = d[regs[0]], com = ch === 'A' ? (tccrA >> 6) & 3 : (tccrA >> 4) & 3;
      if (com < 2) return null;
      const ocr = ch === 'A' ? d[regs[1]] : d[regs[2]];
      const duty = Math.min(1, (ocr + (timer === 't0' ? 1 : 0)) / 256);
      return com === 3 ? 1 - duty : duty;
    }
    const tm = this.t16[timer], b = tm.base, idx = 'ABC'.indexOf(ch), com = (d[b] >> (6 - 2 * idx)) & 3;
    if (com < 2) return null;
    const { top, phase } = this.mode16(tm), ocr = d[b + 8 + 2 * idx] | (d[b + 9 + 2 * idx] << 8);
    const duty = Math.min(1, (ocr + (phase ? 0 : 1)) / (top + 1));
    return com === 3 ? 1 - duty : duty;
  }
  portLevels() { const out = {}; for (const n in this.ports) out[n] = this.readPin(this.ports[n].pin); return out; }
  isc(n) { return n < 4 ? (this.data[0x69] >> (2 * n)) & 3 : (this.data[0x6a] >> (2 * (n - 4))) & 3; }
  // Bordas: alimenta INTn, PCINT, captura de entrada, comparador e as medições de pulso (servo, tone, WS2812).
  levelsChanged() {
    const now = this.portLevels(), prev = this.prevLevels || now, d = this.data;
    for (const port in now) {
      const diff = now[port] ^ prev[port]; if (!diff) continue;
      const pcs = this.pcByPort[port]; if (pcs) for (const [b, g, i] of pcs) if (((diff >> b) & 1) && ((d[0x6b + g] >> i) & 1)) d[0x3b] |= 1 << g;
      for (let b = 0; b < 8; b++) {
        if (!(diff & (1 << b))) continue;
        const name = this.pinName[port + b], level = (now[port] >> b) & 1, t = this.cycles;
        const p = this.pulses[name] || (this.pulses[name] = { rise: -1, high: 0, period: 0, edges: 0, fall: -1, bits: [], frame: null });
        if (level) {
          if (p.fall >= 0 && t - p.fall > 800) this.wsFlush(p); // > 50 µs em nível baixo = reset do WS2812
          if (p.rise >= 0) p.period = t - p.rise; p.rise = t;
        } else if (p.rise >= 0) {
          p.high = t - p.rise; p.fall = t;
          // WS2812 a 800 kHz: bit 1 ≈ 0,8 µs alto (≥ 10 ciclos), bit 0 ≈ 0,4 µs; pulsos longos não são do protocolo.
          if (p.high < 32) p.bits.push(p.high >= 10 ? 1 : 0); else p.bits.length = 0;
        }
        p.edges++; p.last = t;
      }
      for (const tm of this.timers16) { // ICPn: captura de entrada
        if (tm.icp[0] !== port || !((diff >> tm.icp[1]) & 1)) continue;
        const rising = (now[port] >> tm.icp[1]) & 1, ices = d[tm.base + 1] & 0x40;
        if ((rising && ices) || (!rising && !ices)) { this.syncTimers(); d[tm.base + 6] = d[tm.base + 4]; d[tm.base + 7] = d[tm.base + 5]; d[tm.tifr] |= 0x20; }
      }
      if (this.ainPorts[port] & diff) this.syncComparator();
      const ints = this.intByPort[port];
      if (ints) for (const [bit, n] of ints) {
        if (!(diff & (1 << bit))) continue;
        const isc = this.isc(n), level = (now[port] >> bit) & 1;
        if (isc === 1 || (isc === 2 && !level) || (isc === 3 && level)) d[0x3c] |= 1 << n;
      }
    }
    this.prevLevels = now; this.irqCheckAt = 0;
  }
  pinsChanged() {
    if (this.pinDevices.size) this.notifyPinDevices();
    this.levelsChanged();
    if (!this.onPinChange) return;
    const now = this.pinSnapshot(), changed = {};
    for (const k in now) { const a = now[k], b = this.lastPins[k]; if (!b || a.level !== b.level || a.mode !== b.mode || a.duty !== b.duty) changed[k] = a; }
    this.lastPins = now;
    if (Object.keys(changed).length) this.onPinChange(changed, this.cycles / CLOCK, now);
  }

  // ---------- timers ----------
  prescale(cs, t2 = false) { return (t2 ? PRE2 : PRE)[cs & 7]; }
  syncTimers() {
    const now = this.cycles;
    const dt = now - (this.timerSync ?? 0); this.timerSync = now; if (dt <= 0) return;
    this.tick8(this.t0, 0x44, 0x45, 0x46, 0x47, 0x48, 0x35, dt, false);
    const t16 = this.timers16; for (let i = 0; i < t16.length; i++) this.tick16(t16[i], dt);
    this.tick8(this.t2, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0x37, dt, true);
  }
  tick8(st, A, B, CNT, OCA, OCB, TIFR, dt, isT2) {
    const pre = this.prescale(this.data[B], isT2); if (!pre) return;
    st.acc += dt; let ticks = Math.floor(st.acc / pre); st.acc -= ticks * pre; if (!ticks) return;
    const wgm = (this.data[A] & 3) | ((this.data[B] >> 1) & 4);
    const top = (wgm === 2 || wgm === 5 || wgm === 7) ? this.data[OCA] : 0xff;
    const phase = wgm === 1 || wgm === 5, ocA = this.data[OCA], ocB = this.data[OCB];
    // TOV: normal/fast PWM ao passar pelo MAX/TOP; fase correta ao chegar em BOTTOM; CTC só se TOP = MAX.
    const tovAtTop = wgm === 0 || wgm === 3 || wgm === 7 || (wgm === 2 && top === 0xff);
    let cnt = this.data[CNT], flags = 0;
    const period = phase ? 2 * Math.max(1, top) : top + 1;
    if (ticks > 2 * period + 2) { const n = Math.floor((ticks - period - 1) / period); ticks -= n * period; flags |= (tovAtTop || phase ? 1 : 0) | (ocA <= top ? 2 : 0) | (ocB <= top ? 4 : 0); }
    for (; ticks > 0; ticks--) {
      if (phase) { cnt += st.dir || 1; if (cnt >= top) { cnt = top; st.dir = -1; } else if (cnt <= 0) { cnt = 0; st.dir = 1; flags |= 1; } }
      else if (cnt === top) { cnt = 0; if (tovAtTop) flags |= 1; }
      else cnt = (cnt + 1) & 0xff;
      if (cnt === ocA) flags |= 2;
      if (cnt === ocB) flags |= 4;
    }
    this.data[CNT] = cnt & 0xff; this.data[TIFR] |= flags;
  }
  wgm16(b) { return (this.data[b] & 3) | ((this.data[b + 1] >> 1) & 0xc); }
  top16(b, wgm) {
    const d = this.data;
    switch (wgm) { case 1: case 5: return 0xff; case 2: case 6: return 0x1ff; case 3: case 7: return 0x3ff; case 4: case 9: case 11: case 15: return d[b + 8] | (d[b + 9] << 8); case 8: case 10: case 12: case 14: return d[b + 6] | (d[b + 7] << 8); }
    return 0xffff;
  }
  mode16(tm) { const wgm = this.wgm16(tm.base); return { wgm, top: this.top16(tm.base, wgm), phase: (wgm >= 1 && wgm <= 3) || (wgm >= 8 && wgm <= 11) }; }
  tick16(tm, dt) {
    const d = this.data, b = tm.base, pre = this.prescale(d[b + 1]); if (!pre) return; const st = tm.st;
    st.acc += dt; let ticks = Math.floor(st.acc / pre); st.acc -= ticks * pre; if (!ticks) return;
    const wgm = this.wgm16(b), top = this.top16(b, wgm), phase = (wgm >= 1 && wgm <= 3) || (wgm >= 8 && wgm <= 11), F = tm.tifr;
    const ocra = d[b + 8] | (d[b + 9] << 8), ocrb = d[b + 10] | (d[b + 11] << 8), ocrc = tm.ch.length > 2 ? d[b + 12] | (d[b + 13] << 8) : -1;
    let cnt = d[b + 4] | (d[b + 5] << 8);
    const period = phase ? 2 * top : top + 1;
    if (ticks > 4 * period + 4) { ticks -= Math.floor((ticks - 2 * period) / period) * period; }
    for (; ticks > 0; ticks--) {
      if (phase) { cnt += st.dir || 1; if (cnt >= top) { cnt = top; st.dir = -1; } if (cnt <= 0) { cnt = 0; st.dir = 1; d[F] |= 1; } }
      else if (cnt >= top) { cnt = 0; if (wgm === 0 || wgm >= 5) d[F] |= 1; }
      else cnt++;
      if (cnt === ocra) d[F] |= 2;
      if (cnt === ocrb) d[F] |= 4;
      if (cnt === ocrc) d[F] |= 8;
    }
    d[b + 4] = cnt & 0xff; d[b + 5] = (cnt >> 8) & 0xff;
  }

  // ---------- USART0..3 ----------
  usartMode(i = 0) { return (this.data[this.uarts[i].base + 2] >> 6) & 3; } // 0 assíncrono, 1 síncrono, 3 SPI mestre (MSPIM)
  frameCycles(i = 0) { const b = this.uarts[i].base, ubrr = this.data[b + 4] | ((this.data[b + 5] & 0x0f) << 8), mode = this.usartMode(i); if (mode === 3) return Math.max(1, 8 * 2 * (ubrr + 1)); if (mode === 1) return Math.max(1, 10 * 2 * (ubrr + 1)); const div = (this.data[b] & 2) ? 8 : 16; return Math.max(1, 10 * div * (ubrr + 1)); }
  uartWrite(v, i = 0) {
    this.syncUart(i); const u = this.uarts[i];
    if (this.cycles >= u.busyUntil && u.pending === null) { this.emit(v, i); u.busyUntil = this.cycles + this.frameCycles(i); }
    else u.pending = v;
    u.txc = false; u.txcLatched = false;
  }
  emit(v, i = 0) {
    if (this.usartMode(i) === 3) { const dev = i === 0 ? this.mspimDevice : this.mspimDevices?.[i], u = this.uarts[i]; u.rx.push((dev ? dev(v) : 0xff) & 0xff); u.rxNextAt = this.cycles + this.frameCycles(i); return; }
    this.onSerial?.(v, i);
  }
  syncUart(i) {
    if (i === undefined) { for (let k = 0; k < this.uarts.length; k++) this.syncUart(k); return; }
    const u = this.uarts[i];
    if (u.pending !== null && this.cycles >= u.busyUntil) { this.emit(u.pending, i); u.busyUntil += this.frameCycles(i); u.pending = null; }
    if (u.pending === null && u.busyUntil > 0 && this.cycles >= u.busyUntil && !u.txcLatched) { u.txc = true; u.txcLatched = true; }
    if (!u.rxReady && u.rx.length && this.cycles >= u.rxNextAt && (this.data[u.base + 1] & 0x10)) { u.rxData = u.rx.shift(); u.rxReady = true; u.rxNextAt = this.cycles + this.frameCycles(i); }
  }
  serialByte(b, i = 0) { this.uarts[i].rx.push(b & 0xff); this.irqCheckAt = 0; }
  serialInput(text, i = 0) { for (const ch of new TextEncoder().encode(String(text))) this.uarts[i].rx.push(ch); }

  // ---------- ADC ----------
  adcStart() { const adps = this.data[0x7a] & 7, pre = adps < 2 ? 2 : 1 << adps; this.adc.doneAt = this.cycles + 13 * pre; }
  // Tensão do canal escolhido em ADMUX (MUX5 fica em ADCSRB no 2560); 1,1 V = bandgap; diferenciais leem 0.
  muxVolts() {
    const d = this.data;
    if (this.chip.adc > 8) { const m = (d[0x7c] & 0x1f) | ((d[0x7b] & 0x08) << 2); if (m < 8) return this.analog[m]; if (m >= 0x20 && m < 0x28) return this.analog[m - 0x18]; return m === 0x1e ? 1.1 : 0; }
    const m = d[0x7c] & 0x0f; return m < 8 ? this.analog[m] : m === 0x0e ? 1.1 : 0;
  }
  syncAdc() {
    if (this.adc.doneAt < 0 || this.cycles < this.adc.doneAt) return;
    this.adc.doneAt = -1;
    const refs = (this.data[0x7c] >> 6) & 3, vref = this.chip.refs[refs] ?? (this.analogPins.AREF ?? 5), volts = this.muxVolts();
    let value = Math.max(0, Math.min(1023, Math.round(volts / vref * 1023)));
    if (this.data[0x7c] & 0x20) { this.data[0x79] = value >> 2; this.data[0x78] = (value & 3) << 6; } else { this.data[0x78] = value & 0xff; this.data[0x79] = value >> 8; }
    this.data[0x7a] = (this.data[0x7a] & ~0x40) | 0x10;
  }

  // ---------- interrupções ----------
  // Fontes em ordem de vetor: o número menor tem prioridade, como no hardware.
  buildInterrupts() {
    const d = this.data, ch = this.chip, v = ch.vec, S = [];
    // er/em: registrador e máscara de habilitação; só fontes habilitadas chegam a ser avaliadas.
    const add = (vec, er, em, pending, ack) => S.push({ vec, er, em, pending, ack });
    const clr = (reg, mask) => () => { d[reg] &= ~mask; };
    v.INT.forEach((vec, n) => {
      const [port, bit] = this.ints[n], pinAddr = this.ports[port].pin;
      add(vec, 0x3d, 1 << n, () => (((d[0x3c] >> n) & 1) || (this.isc(n) === 0 && !((this.readPin(pinAddr) >> bit) & 1))), clr(0x3c, 1 << n));
    });
    v.PCINT.forEach((vec, g) => add(vec, 0x68, 1 << g, () => ((d[0x68] & d[0x3b]) >> g) & 1, clr(0x3b, 1 << g)));
    add(v.WDT, 0x60, 0x40, () => (d[0x60] & 0xc0) === 0xc0, () => { d[0x60] &= ~0x80; if (d[0x60] & 0x08) d[0x60] &= ~0x40; }); // modo interrupção+reset: próxima vez reinicia
    const timer = (tifr, timsk, bit, vec) => add(vec, timsk, 1 << bit, () => (d[tifr] >> bit) & 1, clr(tifr, 1 << bit));
    timer(0x37, 0x70, 1, v.T2[0]); timer(0x37, 0x70, 2, v.T2[1]); timer(0x37, 0x70, 0, v.T2[2]);
    timer(0x35, 0x6e, 1, v.T0[0]); timer(0x35, 0x6e, 2, v.T0[1]); timer(0x35, 0x6e, 0, v.T0[2]);
    for (const tm of this.timers16) for (const [name, bit] of [['CAPT', 5], ['COMPA', 1], ['COMPB', 2], ['COMPC', 3], ['OVF', 0]]) if (tm.vec[name] !== undefined) timer(tm.tifr, tm.timsk, bit, tm.vec[name]);
    ch.usarts.forEach(({ base: b, vec }, i) => {
      add(vec.RX, b + 1, 0x80, () => this.uarts[i].rxReady);
      add(vec.UDRE, b + 1, 0x20, () => this.uarts[i].pending === null);
      add(vec.TX, b + 1, 0x40, () => this.uarts[i].txc, () => { this.uarts[i].txc = false; });
    });
    add(v.ADC, 0x7a, 0x08, () => d[0x7a] & 0x10, clr(0x7a, 0x10));
    add(v.AC, 0x50, 0x08, () => (d[0x50] & 0x10) && !(d[0x50] & 0x80), clr(0x50, 0x10));
    add(v.EE, 0x3f, 0x08, () => !(d[0x3f] & 0x02));
    add(v.TWI, 0xbc, 0x01, () => d[0xbc] & 0x80); // TWINT não é limpo pela entrada na ISR
    add(v.SPI, 0x4c, 0x80, () => d[0x4d] & 0x80, clr(0x4d, 0x80));
    this.sources = S.sort((a, b) => a.vec - b.vec);
  }
  pendingVector() {
    this.syncTimers(); this.syncUart(); this.syncAdc(); this.syncWdt(); this.syncSpi(); this.syncTwi(); this.syncEeprom();
    const d = this.data, src = this.sources;
    for (let i = 0; i < src.length; i++) { const s = src[i]; if ((d[s.er] & s.em) && s.pending()) return s; }
    return null;
  }
  serviceInterrupt() {
    const s = this.pendingVector(); if (!s) return false;
    s.ack?.(); this.sleeping = false;
    this.pushPC(this.pc); this.data[SREG] &= ~(1 << I); this.pc = s.vec * 2; this.cycles += 4 + this.pcExtra;
    return true;
  }

  // ---------- pilha ----------
  push8(v) { const sp = this.sp; this.data[sp] = v; this.sp = sp - 1; }
  pop8() { const sp = this.sp + 1; this.sp = sp; return this.data[sp]; }
  pushPC(v) { this.push8(v & 0xff); this.push8((v >> 8) & 0xff); if (this.pcExtra) this.push8((v >> 16) & 0xff); }
  popPC() { const hi = this.pcExtra ? this.pop8() : 0, mid = this.pop8(), lo = this.pop8(); return ((hi << 16) | (mid << 8) | lo) & this.pcMask; }

  // ---------- execução ----------
  run(cycles) {
    const end = this.cycles + cycles, start = this.cycles, sleptBefore = this.energy.idle + this.energy.deep;
    // Interrupções são verificadas a cada 16 ciclos (1 µs) ou logo após escrita em E/S, SEI e RETI.
    while (this.cycles < end && !this.halted) {
      if (this.cycles >= this.nextEventAt) this.runEvents();
      if (this.sleeping) { const c0 = this.cycles, deep = this.sleeping !== 'idle' && this.sleeping !== 'adc'; this.sleepUntil(Math.min(end, this.nextEventAt)); this.energy[deep ? 'deep' : 'idle'] += this.cycles - c0; continue; }
      if (this.cycles >= this.irqCheckAt) {
        this.irqCheckAt = this.cycles + 16;
        if ((this.data[SREG] & 0x80) && !this.interruptDelay && this.serviceInterrupt()) continue;
      }
      if (this.interruptDelay) { this.interruptDelay--; this.irqCheckAt = 0; }
      this.step();
    }
    this.syncTimers(); this.syncUart(); this.syncAdc(); this.syncWdt();
    this.energy.active += Math.max(0, (this.cycles - start) - (this.energy.idle + this.energy.deep - sleptBefore));
  }
  runSeconds(s) { this.run(Math.round(s * CLOCK)); }
  get time() { return this.cycles / CLOCK; }

  // ---------- sleep ----------
  sleepUntil(end) {
    const deep = this.sleeping !== 'idle' && this.sleeping !== 'adc';
    if (deep) { // timers 0/1 param; acorda por WDT, INT0/INT1 (nível), PCINT ou TWI
      this.syncTimers(); const wdtAt = this.wdtDueAt(); const target = Math.min(end, wdtAt >= 0 ? wdtAt : end);
      this.cycles = Math.max(this.cycles + 1, target); this.timerSync = this.cycles; for (const u of this.uarts) u.busyUntil = Math.min(u.busyUntil, this.cycles);
    } else this.cycles = Math.min(end, this.cycles + 64);
    if (this.data[SREG] & 0x80) this.serviceInterrupt();
  }

  // ---------- watchdog ----------
  wdtDueAt() { const c = this.data[0x60]; if (!(c & 0x48)) return -1; const wdp = (c & 7) | ((c >> 2) & 8); return this.wdt.last + Math.round((2048 << Math.min(9, wdp)) / 128000 * CLOCK); }
  syncWdt() {
    const due = this.wdtDueAt(); if (due < 0 || this.cycles < due) return;
    const c = this.data[0x60];
    if (c & 0x40) { this.data[0x60] |= 0x80; this.wdt.last = due; }
    else if (c & 0x08) { this.reset('wdt'); }
  }
  wdtWrite(v) {
    this.syncWdt(); const c = this.data[0x60], inWindow = this.cycles <= this.wdt.ceUntil;
    let next = c & ~(v & 0x80); // WDIF: escrever 1 limpa
    if ((v & 0x18) === 0x18 && !inWindow) { this.wdt.ceUntil = this.cycles + 4; next |= 0x18; }
    else if (inWindow) next = (v & 0x6f) | (next & 0x80);
    else next = (next & ~0x40) | (v & 0x40) | (v & 0x08); // WDIE livre; WDE só pode ser ligado
    this.data[0x60] = next & ~0x10; this.wdt.last = this.cycles;
  }

  // ---------- EEPROM ----------
  eepromControl(v) {
    this.syncEeprom(); const addr = (this.data[0x41] | (this.data[0x42] << 8)) & (this.eeprom.length - 1);
    if (v & 0x04) this.ee.mpeUntil = this.cycles + 4;
    if ((v & 0x02) && this.cycles <= this.ee.mpeUntil && !(this.data[0x3f] & 0x02)) {
      const mode = (v >> 4) & 3, dr = this.data[0x40];
      this.eeprom[addr] = mode === 1 ? 0xff : mode === 2 ? this.eeprom[addr] & dr : dr;
      this.ee.busyUntil = this.cycles + Math.round((mode === 0 ? 3.4e-3 : 1.8e-3) * CLOCK); this.ee.mpeUntil = -1;
      this.data[0x3f] = (v & 0x3c) | 0x02; this.onEeprom?.(addr, this.eeprom[addr]); return;
    }
    if (v & 0x01) { this.data[0x40] = this.eeprom[addr]; this.cycles += 4; }
    this.data[0x3f] = (this.data[0x3f] & 0x02) | (v & 0x3c);
  }
  syncEeprom() { if ((this.data[0x3f] & 0x02) && this.cycles >= this.ee.busyUntil) this.data[0x3f] &= ~0x02; if (this.cycles > this.ee.mpeUntil) this.data[0x3f] &= ~0x04; }

  // ---------- SPI (mestre) ----------
  spiWrite(v) {
    this.syncSpi(); const spcr = this.data[0x4c];
    if (this.spi.doneAt >= 0) { this.data[0x4d] |= 0x40; return; } // WCOL
    if (!(spcr & 0x40) || !(spcr & 0x10)) { this.data[0x4e] = v; return; }
    const div = [4, 16, 64, 128][spcr & 3] / ((this.data[0x4d] & 1) ? 2 : 1);
    this.spi.rx = this.spiDevice ? (this.spiDevice(v) ?? 0xff) & 0xff : 0xff;
    this.spi.doneAt = this.cycles + 8 * div; this.data[0x4d] &= ~0xc0; this.spi.flagSeen = false;
  }
  syncSpi() { if (this.spi.doneAt >= 0 && this.cycles >= this.spi.doneAt) { this.spi.doneAt = -1; this.data[0x4e] = this.spi.rx; this.data[0x4d] |= 0x80; } }

  // ---------- TWI / I²C (mestre) ----------
  twiByteCycles(bits) { const twps = this.data[0xb9] & 3, scl = CLOCK / (16 + 2 * this.data[0xb8] * (1 << (2 * twps))); return Math.max(8, Math.round(bits * CLOCK / scl)); }
  twiControl(v) {
    this.syncTwi(); const t = this.twi, d = this.data;
    const keepInt = (d[0xbc] & 0x80) && !(v & 0x80); // escrever 1 em TWINT limpa a flag
    d[0xbc] = (v & 0x7f) | (keepInt ? 0x80 : 0);
    if (!(v & 0x04)) { t.phase = 'idle'; t.device = null; t.doneAt = -1; t.slave = false; d[0xb9] = (d[0xb9] & 3) | 0xf8; return; }
    if (!(v & 0x80)) return;
    if (t.slave && !(v & 0x30)) { if ((d[0xb9] & 0xf8) === 0xa0 || (d[0xb9] & 0xf8) === 0xc0 || (d[0xb9] & 0xf8) === 0xc8) t.slave = false; return; } // escravo: só libera o barramento
    const status = st => { d[0xb9] = (d[0xb9] & 3) | st; d[0xbc] |= 0x80; };
    if (v & 0x10) { // STOP
      const dev = t.device;
      t.op = { run: () => { dev?.stop?.(); t.device = null; t.phase = 'idle'; d[0xbc] &= ~0x10; d[0xb9] = (d[0xb9] & 3) | 0xf8; if (v & 0x20) { t.phase = 'start'; status(0x08); } } };
      t.doneAt = this.cycles + this.twiByteCycles(1); return;
    }
    if (v & 0x20) { // START ou START repetido
      const repeated = t.phase !== 'idle', dev = t.device;
      t.op = { run: () => { if (repeated) dev?.stop?.(); t.phase = 'start'; t.device = null; status(repeated ? 0x10 : 0x08); d[0xbc] &= ~0x20; } };
      t.doneAt = this.cycles + this.twiByteCycles(1); return;
    }
    // Endereço, escrita e leitura acontecem ao fim do byte; um escravo lento (outro chip) segura o SCL (clock stretching).
    if (t.phase === 'start') {
      const sla = d[0xbb], addr = sla >> 1, read = !!(sla & 1);
      const dev = this.i2c.get(addr) ?? this.i2cPeers?.find(p => p.matches(addr));
      t.op = { dev, before: () => { t.ack = !!dev && dev.start?.(read) !== false; }, run: () => { t.device = t.ack ? dev : null; t.read = read; t.phase = t.ack ? (read ? 'mr' : 'mt') : 'nack'; status(read ? (t.ack ? 0x40 : 0x48) : (t.ack ? 0x18 : 0x20)); } };
    } else if (t.phase === 'mt') {
      const dev = t.device, byte = d[0xbb];
      t.op = { dev, before: () => { t.ack = dev ? dev.write?.(byte) !== false : false; }, run: () => status(t.ack ? 0x28 : 0x30) };
    } else if (t.phase === 'mr') {
      const dev = t.device, ackOut = !!(v & 0x40);
      t.op = { dev, waitFirst: true, run: () => { d[0xbb] = (dev?.read?.(ackOut) ?? 0xff) & 0xff; status(ackOut ? 0x50 : 0x58); } };
    } else t.op = { run: () => status(0xf8) };
    t.doneAt = this.cycles + this.twiByteCycles(9);
  }
  syncTwi() {
    const t = this.twi; if (t.doneAt < 0 || this.cycles < t.doneAt) return;
    const op = t.op;
    if (op?.before && !op.started) { op.started = true; op.before(); }
    if (op?.dev?.busy?.()) { t.doneAt = this.cycles + 16; return; } // escravo ainda processando
    t.doneAt = -1; t.op = null; op?.run(); this.irqCheckAt = 0;
  }
  // Este chip como escravo I²C de outro (Wire.begin(endereço)): adaptador para o barramento do mestre.
  i2cSlave() {
    const d = this.data, t = this.twi, me = this;
    const raise = st => { t.slave = true; d[0xb9] = (d[0xb9] & 3) | st; d[0xbc] |= 0x80; me.irqCheckAt = 0; };
    return {
      matches: addr => (d[0xbc] & 0x44) === 0x44 && (d[0xba] >> 1) === addr,
      busy: () => !!(d[0xbc] & 0x80),
      mode: null,
      start(read) { if (this.mode === 'sr') raise(0xa0); this.mode = read ? 'st' : 'sr'; raise(read ? 0xa8 : 0x60); return true; },
      write(b) { const ack = !!(d[0xbc] & 0x40); d[0xbb] = b; raise(ack ? 0x80 : 0x88); return ack; },
      read(ack) { const b = d[0xbb]; raise(ack ? 0xb8 : 0xc0); if (!ack) this.mode = null; return b; },
      // STOP só é visto pelo escravo receptor; depois de um NACK o transmissor já saiu do modo endereçado.
      stop() { if (this.mode === 'sr') raise(0xa0); this.mode = null; },
    };
  }
  linkI2C(slaveMcu) { (this.i2cPeers ||= []).push(slaveMcu.i2cSlave()); }
  // Este chip como escravo SPI: o mestre troca um byte por vez com SS (D10 no Uno, D53 no Mega) em nível baixo.
  spiSlaveExchange(byte) {
    const spcr = this.data[0x4c]; if (!(spcr & 0x40) || (spcr & 0x10) || this.levelOf(this.chip.ss)) return 0xff;
    const out = this.data[0x4e]; this.data[0x4e] = byte; this.data[0x4d] |= 0x80; this.spi.flagSeen = false; this.irqCheckAt = 0; return out;
  }
  // ssPin: pino deste chip ligado ao SS do escravo; o nível é repassado a cada byte.
  linkSPI(slaveMcu, ssPin) {
    this.spiDevice = b => { if (ssPin) slaveMcu.setInput(slaveMcu.chip.ss, this.levelOf(ssPin)); return slaveMcu.spiSlaveExchange(b); };
  }

  flags(mask, values) { this.data[SREG] = (this.data[SREG] & ~mask) | values; }
  step() {
    const d = this.data, op = this.prog[this.pc];
    const pc = this.pc; this.pc = (pc + 1) & this.pcMask;
    const rd5 = (op >> 4) & 0x1f, rr5 = (op & 0x0f) | ((op >> 5) & 0x10);
    const sreg = d[SREG];
    switch (op >> 12) {
      case 0x0: {
        if (op === 0) { this.cycles++; return; }
        const sub = (op >> 10) & 3;
        if (sub === 0) {
          const k = (op >> 8) & 3;
          if (k === 1) { const dd = ((op >> 4) & 0xf) * 2, rr = (op & 0xf) * 2; d[dd] = d[rr]; d[dd + 1] = d[rr + 1]; this.cycles++; return; } // MOVW
          if (k === 2) { const a = d[16 + ((op >> 4) & 0xf)] << 24 >> 24, b = d[16 + (op & 0xf)] << 24 >> 24; this.mulResult(a * b); return; } // MULS
          if (k === 3) {
            const a = d[16 + ((op >> 4) & 7)], b = d[16 + (op & 7)], kind = ((op >> 6) & 2) | ((op >> 3) & 1);
            if (kind === 0) this.mulResult((a << 24 >> 24) * b); // MULSU
            else { const r = kind === 1 ? a * b : kind === 2 ? (a << 24 >> 24) * (b << 24 >> 24) : (a << 24 >> 24) * b; this.fmulResult(r); }
            return;
          }
          this.cycles++; return;
        }
        if (sub === 1) { this.subOp(d[rd5], d[rr5], (sreg & 1), true); this.cycles++; return; } // CPC
        if (sub === 2) { d[rd5] = this.subOp(d[rd5], d[rr5], (sreg & 1), true); this.cycles++; return; } // SBC
        d[rd5] = this.addOp(d[rd5], d[rr5], 0); this.cycles++; return; // ADD
      }
      case 0x1: {
        const sub = (op >> 10) & 3;
        if (sub === 0) { if (d[rd5] === d[rr5]) this.skip(); this.cycles++; return; } // CPSE
        if (sub === 1) { this.subOp(d[rd5], d[rr5], 0, false); this.cycles++; return; } // CP
        if (sub === 2) { d[rd5] = this.subOp(d[rd5], d[rr5], 0, false); this.cycles++; return; } // SUB
        d[rd5] = this.addOp(d[rd5], d[rr5], sreg & 1); this.cycles++; return; // ADC
      }
      case 0x2: {
        const sub = (op >> 10) & 3;
        if (sub === 3) { d[rd5] = d[rr5]; this.cycles++; return; } // MOV
        const r = sub === 0 ? d[rd5] & d[rr5] : sub === 1 ? d[rd5] ^ d[rr5] : d[rd5] | d[rr5];
        d[rd5] = r; this.logicFlags(r); this.cycles++; return;
      }
      case 0x3: { const k = ((op >> 4) & 0xf0) | (op & 0xf), r = 16 + ((op >> 4) & 0xf); this.subOp(d[r], k, 0, false); this.cycles++; return; } // CPI
      case 0x4: { const k = ((op >> 4) & 0xf0) | (op & 0xf), r = 16 + ((op >> 4) & 0xf); d[r] = this.subOp(d[r], k, sreg & 1, true); this.cycles++; return; } // SBCI
      case 0x5: { const k = ((op >> 4) & 0xf0) | (op & 0xf), r = 16 + ((op >> 4) & 0xf); d[r] = this.subOp(d[r], k, 0, false); this.cycles++; return; } // SUBI
      case 0x6: { const k = ((op >> 4) & 0xf0) | (op & 0xf), r = 16 + ((op >> 4) & 0xf); d[r] |= k; this.logicFlags(d[r]); this.cycles++; return; } // ORI
      case 0x7: { const k = ((op >> 4) & 0xf0) | (op & 0xf), r = 16 + ((op >> 4) & 0xf); d[r] &= k; this.logicFlags(d[r]); this.cycles++; return; } // ANDI
      case 0x8: case 0xa: { // LDD/STD com deslocamento q (Y ou Z)
        const q = (op & 7) | ((op >> 7) & 0x18) | ((op >> 8) & 0x20), base = op & 8 ? 28 : 30, addr = (d[base] | (d[base + 1] << 8)) + q;
        if (op & 0x200) this.write(addr, d[rd5]); else d[rd5] = this.read(addr);
        this.cycles += 2; return;
      }
      case 0x9: return this.op9(op, rd5, rr5, sreg);
      case 0xb: { const a = (op & 0xf) | ((op >> 5) & 0x30); if (op & 0x800) this.write(a + 0x20, d[rd5]); else d[rd5] = this.read(a + 0x20); this.cycles++; return; } // IN/OUT
      case 0xc: { this.pc = (this.pc + ((op << 20) >> 20)) & this.pcMask; this.cycles += 2; return; } // RJMP
      case 0xd: { this.pushPC(this.pc); this.pc = (this.pc + ((op << 20) >> 20)) & this.pcMask; this.cycles += 3 + this.pcExtra; return; } // RCALL
      case 0xe: { d[16 + ((op >> 4) & 0xf)] = ((op >> 4) & 0xf0) | (op & 0xf); this.cycles++; return; } // LDI
      case 0xf: {
        const sub = (op >> 9) & 7, bit = op & 7;
        if (sub <= 3) { // BRBS/BRBC
          const set = (sreg >> bit) & 1, want = (op & 0x400) ? 0 : 1;
          if (set === want) { this.pc = (this.pc + (((op >> 3) << 25) >> 25)) & this.pcMask; this.cycles += 2; } else this.cycles++;
          return;
        }
        if (sub === 4) { d[rd5] = (d[rd5] & ~(1 << bit)) | (((sreg >> T) & 1) << bit); this.cycles++; return; } // BLD
        if (sub === 5) { this.flags(1 << T, ((d[rd5] >> bit) & 1) << T); this.cycles++; return; } // BST
        const isSet = (d[rd5] >> bit) & 1; // SBRC / SBRS
        if ((sub === 6 && !isSet) || (sub === 7 && isSet)) this.skip();
        this.cycles++; return;
      }
    }
    this.cycles++;
  }
  op9(op, rd5, rr5, sreg) {
    const d = this.data;
    if ((op & 0xfc00) === 0x9c00) { this.mulResult(d[rd5] * d[rr5]); return; } // MUL
    if ((op & 0xfe00) === 0x9000 || (op & 0xfe00) === 0x9200) {
      const store = op & 0x200, mode = op & 0xf;
      const X = () => d[26] | (d[27] << 8), Y = () => d[28] | (d[29] << 8), Zr = () => d[30] | (d[31] << 8);
      const setW = (r, v) => { d[r] = v & 0xff; d[r + 1] = (v >> 8) & 0xff; };
      const mem = (addr) => { if (store) this.write(addr, d[rd5]); else d[rd5] = this.read(addr); };
      switch (mode) {
        case 0x0: { const addr = this.prog[this.pc]; this.pc = (this.pc + 1) & this.pcMask; mem(addr); this.cycles += 2; return; } // LDS/STS
        case 0x1: { const a = Zr(); mem(a); setW(30, a + 1); this.cycles += 2; return; }
        case 0x2: { const a = (Zr() - 1) & 0xffff; setW(30, a); mem(a); this.cycles += 2; return; }
        case 0x4: case 0x5: if (!store) { const z = Zr(); d[rd5] = this.flashBytes[z & this.flashMask]; if (mode === 5) setW(30, z + 1); this.cycles += 3; return; } break; // LPM
        case 0x6: case 0x7: if (!store) { const z = (d[RAMPZ] << 16) | Zr(); d[rd5] = this.flashBytes[z & this.flashMask]; if (mode === 7) { const n = z + 1; setW(30, n); d[RAMPZ] = (n >> 16) & 0xff; } this.cycles += 3; return; } break; // ELPM (RAMPZ:Z)
        case 0x9: { const a = Y(); mem(a); setW(28, a + 1); this.cycles += 2; return; }
        case 0xa: { const a = (Y() - 1) & 0xffff; setW(28, a); mem(a); this.cycles += 2; return; }
        case 0xc: { mem(X()); this.cycles += 2; return; }
        case 0xd: { const a = X(); mem(a); setW(26, a + 1); this.cycles += 2; return; }
        case 0xe: { const a = (X() - 1) & 0xffff; setW(26, a); mem(a); this.cycles += 2; return; }
        case 0xf: if (store) this.push8(d[rd5]); else d[rd5] = this.pop8(); this.cycles += 2; return; // PUSH/POP
      }
      this.cycles++; return;
    }
    if ((op & 0xfe08) === 0x9400 && (op & 0xf) < 8 || ((op & 0xfe0f) === 0x940a)) { // operações de um registrador
      const r = d[rd5]; let v;
      switch (op & 0xf) {
        case 0x0: v = (~r) & 0xff; d[rd5] = v; this.flags(0x1f, (1) | (v === 0 ? 2 : 0) | (v & 0x80 ? 4 : 0) | (v & 0x80 ? 0x10 : 0)); break; // COM
        case 0x1: v = (-r) & 0xff; d[rd5] = v; { const h = ((v | r) >> 3) & 1, vf = v === 0x80 ? 1 : 0, n = v >> 7; this.flags(0x3f, (v !== 0 ? 1 : 0) | (v === 0 ? 2 : 0) | (n << 2) | (vf << 3) | ((n ^ vf) << 4) | (h << 5)); } break; // NEG
        case 0x2: d[rd5] = ((r << 4) | (r >> 4)) & 0xff; break; // SWAP
        case 0x3: v = (r + 1) & 0xff; d[rd5] = v; { const vf = r === 0x7f ? 1 : 0, n = v >> 7; this.flags(0x1e, (v === 0 ? 2 : 0) | (n << 2) | (vf << 3) | ((n ^ vf) << 4)); } break; // INC
        case 0x5: v = (r >> 1) | (r & 0x80); d[rd5] = v; this.shiftFlags(v, r & 1); break; // ASR
        case 0x6: v = r >> 1; d[rd5] = v; this.shiftFlags(v, r & 1); break; // LSR
        case 0x7: v = (r >> 1) | ((sreg & 1) << 7); d[rd5] = v; this.shiftFlags(v, r & 1); break; // ROR
        case 0xa: v = (r - 1) & 0xff; d[rd5] = v; { const vf = r === 0x80 ? 1 : 0, n = v >> 7; this.flags(0x1e, (v === 0 ? 2 : 0) | (n << 2) | (vf << 3) | ((n ^ vf) << 4)); } break; // DEC
      }
      this.cycles++; return;
    }
    if ((op & 0xff8f) === 0x9408) { const b = (op >> 4) & 7; d[SREG] |= 1 << b; if (b === I) this.interruptDelay = 1; this.cycles++; return; } // BSET (SEI…)
    if ((op & 0xff8f) === 0x9488) { d[SREG] &= ~(1 << ((op >> 4) & 7)); this.cycles++; return; } // BCLR (CLI…)
    switch (op) {
      case 0x9508: this.pc = this.popPC(); this.cycles += 4 + this.pcExtra; return; // RET
      case 0x9518: this.pc = this.popPC(); d[SREG] |= 0x80; this.interruptDelay = 1; this.cycles += 4 + this.pcExtra; return; // RETI
      case 0x9588: this.cycles++; if (this.data[0x53] & 1) this.sleeping = ['idle', 'adc', 'power-down', 'power-save', '?', '?', 'standby', 'ext-standby'][(this.data[0x53] >> 1) & 7]; return; // SLEEP
      case 0x95a8: this.wdt.last = this.cycles; this.cycles++; return; // WDR
      case 0x95e8: case 0x95f8: this.cycles++; return; // SPM
      case 0x9598: this.halted = true; this.lastError = 'BREAK'; return;
      case 0x95c8: d[0] = this.flashBytes[(d[30] | (d[31] << 8)) & this.flashMask]; this.cycles += 3; return; // LPM r0
      case 0x95d8: d[0] = this.flashBytes[((d[RAMPZ] << 16) | d[30] | (d[31] << 8)) & this.flashMask]; this.cycles += 3; return; // ELPM r0
      case 0x9409: this.pc = (d[30] | (d[31] << 8)) & this.pcMask; this.cycles += 2; return; // IJMP
      case 0x9509: this.pushPC(this.pc); this.pc = (d[30] | (d[31] << 8)) & this.pcMask; this.cycles += 3 + this.pcExtra; return; // ICALL
      case 0x9419: this.pc = ((d[EIND] << 16) | d[30] | (d[31] << 8)) & this.pcMask; this.cycles += 2; return; // EIJMP
      case 0x9519: this.pushPC(this.pc); this.pc = ((d[EIND] << 16) | d[30] | (d[31] << 8)) & this.pcMask; this.cycles += 3 + this.pcExtra; return; // EICALL
    }
    if ((op & 0xfe0e) === 0x940c || (op & 0xfe0e) === 0x940e) { // JMP / CALL
      const k = (((op >> 3) & 0x3e) | (op & 1)) << 16 | this.prog[this.pc]; this.pc = (this.pc + 1) & this.pcMask;
      if (op & 2) { this.pushPC(this.pc); this.cycles += 4 + this.pcExtra; } else this.cycles += 3;
      this.pc = k & this.pcMask; return;
    }
    if ((op & 0xfe00) === 0x9600) { // ADIW / SBIW
      const r = 24 + ((op >> 3) & 6), k = (op & 0xf) | ((op >> 2) & 0x30), w = d[r] | (d[r + 1] << 8);
      const sub = op & 0x100, res = (sub ? w - k : w + k) & 0xffff; d[r] = res & 0xff; d[r + 1] = res >> 8;
      const rh7 = (w >> 15) & 1, r15 = res >> 15;
      const vf = sub ? (rh7 & ~r15) & 1 : (~rh7 & r15) & 1, cf = sub ? (r15 & ~rh7) & 1 : (~r15 & rh7) & 1;
      this.flags(0x1f, cf | (res === 0 ? 2 : 0) | (r15 << 2) | (vf << 3) | ((r15 ^ vf) << 4)); this.cycles += 2; return;
    }
    if ((op & 0xfc00) === 0x9800) { // CBI, SBIC, SBI, SBIS
      const a = 0x20 + ((op >> 3) & 0x1f), b = op & 7, kind = (op >> 8) & 3;
      if (kind === 0) this.write(a, this.ioPortValue(a) & ~(1 << b));
      else if (kind === 2) this.write(a, this.ioPortValue(a) | (1 << b));
      else { const set = (this.read(a) >> b) & 1; if ((kind === 1 && !set) || (kind === 3 && set)) this.skip(); }
      this.cycles += 2; return;
    }
    this.cycles++;
  }
  // SBI/CBI em PINx alterna só o bit escrito; nos demais é ler-modificar-escrever.
  ioPortValue(a) { return this.portByPinAddr[a] ? 0 : this.read(a); }
  skip() { const next = this.prog[this.pc]; const two = (next & 0xfe0f) === 0x9000 || (next & 0xfe0f) === 0x9200 || (next & 0xfe0e) === 0x940c || (next & 0xfe0e) === 0x940e; this.pc = (this.pc + (two ? 2 : 1)) & this.pcMask; this.cycles += two ? 2 : 1; }
  addOp(a, b, c) {
    const r = (a + b + c) & 0xff, a7 = a >> 7, b7 = b >> 7, r7 = r >> 7;
    const h = (((a & b) | (b & ~r) | (~r & a)) >> 3) & 1, cf = ((a7 & b7) | (b7 & ~r7) | (~r7 & a7)) & 1, vf = ((a7 & b7 & ~r7) | (~a7 & ~b7 & r7)) & 1;
    this.flags(0x3f, cf | (r === 0 ? 2 : 0) | (r7 << 2) | (vf << 3) | ((r7 ^ vf) << 4) | (h << 5)); return r;
  }
  subOp(a, b, c, keepZ) {
    const r = (a - b - c) & 0xff, a7 = a >> 7, b7 = b >> 7, r7 = r >> 7;
    const h = (((~a & b) | (b & r) | (r & ~a)) >> 3) & 1, cf = ((~a7 & b7) | (b7 & r7) | (r7 & ~a7)) & 1, vf = ((a7 & ~b7 & ~r7) | (~a7 & b7 & r7)) & 1;
    const z = keepZ ? (r === 0 && (this.data[SREG] & 2) ? 2 : 0) : (r === 0 ? 2 : 0);
    this.flags(0x3f, cf | z | (r7 << 2) | (vf << 3) | ((r7 ^ vf) << 4) | (h << 5)); return r;
  }
  logicFlags(r) { const n = r >> 7; this.flags(0x1e, (r === 0 ? 2 : 0) | (n << 2) | (n << 4)); }
  shiftFlags(r, carry) { const n = r >> 7, vf = n ^ carry; this.flags(0x1f, carry | (r === 0 ? 2 : 0) | (n << 2) | (vf << 3) | ((n ^ vf) << 4)); }
  mulResult(v) { const r = v & 0xffff; this.data[0] = r & 0xff; this.data[1] = r >> 8; this.flags(3, ((r >> 15) & 1) | (r === 0 ? 2 : 0)); this.cycles += 2; }
  fmulResult(v) { const raw = v & 0xffff, r = (raw << 1) & 0xffff; this.data[0] = r & 0xff; this.data[1] = r >> 8; this.flags(3, ((raw >> 15) & 1) | (r === 0 ? 2 : 0)); this.cycles += 2; }
}

// Fábricas (funcionam com ou sem new). Todo chip é um AVR com a mesma forma de objeto: o V8 mantém o código quente
// monomórfico mesmo com Uno e Mega rodando juntos (subclasses deixavam o emulador ~40 % mais lento).
export function ATmega328P(hex) { return new AVR(hex, CHIPS.atmega328p); }
export function ATmega2560(hex) { return new AVR(hex, CHIPS.atmega2560); }
// mcu: 'atmega328p', 'atmega2560' ou 'auto' (pela tabela de vetores do firmware).
export function createMcu(hex, mcu = 'auto') {
  const parsed = typeof hex === 'string' ? parseHex(hex) : hex, id = mcu === 'auto' || !mcu ? detectChip(parsed) : String(mcu).toLowerCase();
  if (!CHIPS[id]) throw new Error(`Chip não suportado: ${mcu} (use atmega328p ou atmega2560)`);
  return new AVR(parsed, CHIPS[id]);
}
