// Emulador do ATmega328P (Arduino Uno) escrito para o Hardware Studio.
// Referências: Microchip "AVR Instruction Set Manual" (DS40002198) e datasheet ATmega328P (DS40002061).
// Escopo: núcleo AVR completo do 328P, interrupções com vetores reais, GPIO B/C/D, Timer0/1/2 (contagem,
// comparação, overflow e PWM por registradores), USART0 (TX/RX com tempo de quadro), ADC e Intel HEX.
// Também: EEPROM (1 KB, persistente entre resets), INT0/INT1 e PCINT, watchdog (interrupção e reset), sleep
// (idle e power-down), SPI mestre e TWI/I²C mestre com dispositivos plugáveis (ver devices.mjs).
// Fora do escopo: comparador analógico, captura de entrada do Timer1, USART síncrono e consumo elétrico.

export const CLOCK = 16_000_000;
const SREG = 0x5f, SPL = 0x5d, SPH = 0x5e;
const C = 0, Z = 1, N = 2, V = 3, S = 4, H = 5, T = 6, I = 7;
// Vetores de interrupção do 328P (número do vetor; endereço em palavras = número × 2).
export const VEC = { INT0: 1, INT1: 2, PCINT0: 3, PCINT1: 4, PCINT2: 5, WDT: 6, TIMER2_COMPA: 7, TIMER2_COMPB: 8, TIMER2_OVF: 9, TIMER1_CAPT: 10, TIMER1_COMPA: 11, TIMER1_COMPB: 12, TIMER1_OVF: 13, TIMER0_COMPA: 14, TIMER0_COMPB: 15, TIMER0_OVF: 16, SPI_STC: 17, USART_RX: 18, USART_UDRE: 19, USART_TX: 20, ADC: 21, EE_READY: 22, ANALOG_COMP: 23, TWI: 24, SPM_READY: 25 };

export function parseHex(text) {
  const flash = new Uint8Array(32768); let max = 0, base = 0;
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

const PORTS = { B: { pin: 0x23, ddr: 0x24, port: 0x25 }, C: { pin: 0x26, ddr: 0x27, port: 0x28 }, D: { pin: 0x29, ddr: 0x2a, port: 0x2b } };
// Pinos do Uno → porta/bit.
export const UNO_PINS = Object.fromEntries([
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(b => [`D${b}`, ['D', b]]),
  ...[0, 1, 2, 3, 4, 5].map(b => [`D${b + 8}`, ['B', b]]),
  ...[0, 1, 2, 3, 4, 5].map(b => [`A${b}`, ['C', b]]),
]);
const PWM_PINS = { D6: ['t0', 'A'], D5: ['t0', 'B'], D9: ['t1', 'A'], D10: ['t1', 'B'], D11: ['t2', 'A'], D3: ['t2', 'B'] };

export class ATmega328P {
  constructor(hex) {
    const { flash, size } = typeof hex === 'string' ? parseHex(hex) : hex;
    this.flashBytes = flash; this.programSize = size;
    this.prog = new Uint16Array(16384);
    for (let i = 0; i < 16384; i++) this.prog[i] = flash[2 * i] | (flash[2 * i + 1] << 8);
    this.data = new Uint8Array(0x900);
    this.onSerial = null; this.onPinChange = null;
    this.inputs = { B: new Array(8).fill(null), C: new Array(8).fill(null), D: new Array(8).fill(null) };
    this.analog = new Array(8).fill(0); // volts nas entradas A0..A7
    this.eeprom = new Uint8Array(1024).fill(0xff); // sobrevive a reset, como a EEPROM real
    this.i2c = new Map(); this.spiDevice = null; this.onReset = null;
    this.cycles = 0; this.reset('power');
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
    this.sleeping = false; this.pulses = {};
    this.sp = 0x8ff; this.interruptDelay = 0; this.irqCheckAt = 0;
    this.t0 = { acc: 0, flags: 0 }; this.t1 = { acc: 0, dir: 1 }; this.t2 = { acc: 0, dir: 1 };
    this.uart = { busyUntil: 0, pending: null, txc: false, rx: [], rxNextAt: 0, rxData: 0, rxReady: false };
    this.adc = { doneAt: -1 };
    this.data[0xc0] = 0x20; // UDRE0 vazio
    this.lastPins = this.pinSnapshot(); this.prevLevels = this.portLevels();
    if (kind !== 'power') this.onReset?.(kind);
  }
  get sp() { return this.data[SPL] | (this.data[SPH] << 8); }
  set sp(v) { this.data[SPL] = v & 0xff; this.data[SPH] = (v >> 8) & 0xff; }

  // ---------- memória de dados com periféricos ----------
  read(addr) {
    addr &= 0xffff; if (addr >= 0x900) return 0;
    switch (addr) {
      case 0x23: case 0x26: case 0x29: return this.readPin(addr);
      case 0x46: this.syncTimers(); return this.data[0x46];
      case 0xc0: this.syncUart(); return (this.data[0xc0] & 0x1f) | (this.uart.pending === null ? 0x20 : 0) | (this.uart.txc ? 0x40 : 0) | (this.uart.rxReady ? 0x80 : 0);
      case 0xc6: this.syncUart(); this.uart.rxReady = false; return this.uart.rxData;
      case 0x7a: this.syncAdc(); return this.data[0x7a];
      case 0x84: this.syncTimers(); this.temp16 = this.data[0x85]; return this.data[0x84];
      case 0x85: case 0x87: case 0x89: case 0x8b: return this.temp16 ?? this.data[addr];
      case 0x86: case 0x88: case 0x8a: this.temp16 = this.data[addr + 1]; return this.data[addr];
      case 0xb2: this.syncTimers(); return this.data[0xb2];
      case 0x35: this.syncTimers(); return this.data[0x35];
      case 0x36: case 0x37: this.syncTimers(); return this.data[addr];
      case 0x3f: this.syncEeprom(); return this.data[0x3f];
      case 0x4d: this.syncSpi(); if (this.data[0x4d] & 0x80) this.spi.flagSeen = true; return this.data[0x4d];
      case 0x4e: this.syncSpi(); if (this.spi.flagSeen) { this.data[0x4d] &= ~0x80; this.spi.flagSeen = false; } return this.data[0x4e];
      case 0xb9: case 0xbb: case 0xbc: this.syncTwi(); return this.data[addr];
      case 0x60: this.syncWdt(); return this.data[0x60];
    }
    return this.data[addr];
  }
  write(addr, v) {
    addr &= 0xffff; v &= 0xff; if (addr >= 0x900) return;
    if (addr >= 0x20 && addr < 0x100) this.irqCheckAt = 0;
    switch (addr) {
      case 0x23: case 0x26: case 0x29: this.data[addr + 2] ^= v; this.pinsChanged(); return; // PINx: escrever 1 alterna PORTx
      case 0x24: case 0x25: case 0x27: case 0x28: case 0x2a: case 0x2b: this.data[addr] = v; this.pinsChanged(); return;
      case 0x35: case 0x36: case 0x37: this.syncTimers(); this.data[addr] &= ~v; return; // escrever 1 limpa a flag
      case 0x46: case 0xb2: this.syncTimers(); this.data[addr] = v; return;
      case 0x44: case 0x45: case 0x80: case 0x81: case 0xb0: case 0xb1: this.syncTimers(); this.data[addr] = v; this.pinsChanged(); return;
      case 0x47: case 0x48: case 0xb3: case 0xb4: this.data[addr] = v; this.pinsChanged(); return;
      // Registradores de 16 bits do Timer1 usam o registrador TEMP: o byte alto é escrito primeiro.
      case 0x85: case 0x87: case 0x89: case 0x8b: this.temp16 = v; return;
      case 0x84: this.syncTimers(); this.data[0x85] = this.temp16 ?? 0; this.data[0x84] = v; return;
      case 0x86: case 0x88: case 0x8a: this.data[addr + 1] = this.temp16 ?? 0; this.data[addr] = v; this.pinsChanged(); return;
      case 0xc0: this.syncUart(); if (v & 0x40) this.uart.txc = false; this.data[0xc0] = (this.data[0xc0] & ~0x03) | (v & 0x03); return;
      case 0xc6: this.uartWrite(v); return;
      case 0x3c: case 0x3b: this.data[addr] &= ~v; return; // EIFR/PCIFR: escrever 1 limpa
      case 0x69: case 0x3d: case 0x68: case 0x6b: case 0x6c: case 0x6d: this.data[addr] = v; return;
      case 0x3f: this.eepromControl(v); return;
      case 0x4e: this.spiWrite(v); return;
      case 0xbc: this.twiControl(v); return;
      case 0x60: this.wdtWrite(v); return;
      case 0x7a: {
        this.syncAdc(); const old = this.data[0x7a];
        const flag = (old & 0x10) && !(v & 0x10) ? 0x10 : 0; // escrever 1 em ADIF limpa
        this.data[0x7a] = (v & ~0x10) | flag;
        if ((v & 0x40) && !(old & 0x40)) this.adcStart();
        return;
      }
    }
    this.data[addr] = v;
  }
  readPin(pinAddr) {
    const name = pinAddr === 0x23 ? 'B' : pinAddr === 0x26 ? 'C' : 'D', p = PORTS[name];
    const ddr = this.data[p.ddr], port = this.data[p.port]; let value = 0;
    for (let b = 0; b < 8; b++) {
      let level;
      if (ddr & (1 << b)) level = (port >> b) & 1;
      else { const ext = this.inputs[name][b]; level = ext === null ? ((port >> b) & 1) : ext ? 1 : 0; } // flutuante com pull-up lê 1
      value |= level << b;
    }
    return value;
  }
  setInput(pinName, level) { const [port, bit] = UNO_PINS[pinName]; const v = level === null || level === undefined ? null : level ? 1 : 0; if (this.inputs[port][bit] === v) return; this.inputs[port][bit] = v; this.pinsChanged(); }
  wsFlush(p) {
    if (p.bits.length >= 24) { const bytes = []; for (let i = 0; i + 8 <= p.bits.length; i += 8) bytes.push(p.bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0)); const px = []; for (let i = 0; i + 3 <= bytes.length; i += 3) px.push([bytes[i + 1], bytes[i], bytes[i + 2]]); p.frame = px; p.frames = (p.frames || 0) + 1; }
    p.bits = [];
  }
  // Cores do último quadro WS2812 (NeoPixel, ordem GRB no fio) enviado pelo pino: [[r,g,b], ...].
  neopixel(pin) { const p = this.pulses[pin]; if (!p) return null; if (p.bits.length && this.cycles - p.fall > 800) this.wsFlush(p); return p.frame; }
  // Frequência e largura de pulso medidas no pino (para servo, tone e PWM por software).
  pulseInfo(pin) { const p = this.pulses[pin]; if (!p || p.last === undefined || this.cycles - p.last > CLOCK / 4) return null; return { highUs: p.high / 16, periodUs: p.period / 16, hz: p.period ? CLOCK / p.period : 0 }; }

  pinSnapshot() {
    const out = {};
    for (const [name, [port, bit]] of Object.entries(UNO_PINS)) {
      const p = PORTS[port], out_ = (this.data[p.ddr] >> bit) & 1, lvl = (this.data[p.port] >> bit) & 1;
      let duty = null; const pwm = PWM_PINS[name];
      if (pwm && out_) duty = this.pwmDuty(pwm[0], pwm[1]);
      out[name] = { mode: out_ ? 'output' : lvl ? 'input_pullup' : 'input', level: duty !== null ? (duty > 0 ? 1 : 0) : lvl, duty: duty !== null ? duty : (out_ ? lvl : null) };
    }
    return out;
  }
  pwmDuty(timer, ch) {
    const regs = { t0: [0x44, 0x47, 0x48], t1: [0x80, 0x88, 0x8a], t2: [0xb0, 0xb3, 0xb4] }[timer];
    const tccrA = this.data[regs[0]], com = ch === 'A' ? (tccrA >> 6) & 3 : (tccrA >> 4) & 3;
    if (com < 2) return null;
    const ocr = ch === 'A' ? this.data[regs[1]] : this.data[regs[2]];
    const duty = Math.min(1, (ocr + (timer === 't0' ? 1 : 0)) / 256);
    return com === 3 ? 1 - duty : duty;
  }
  portLevels() { return { B: this.readPin(0x23), C: this.readPin(0x26), D: this.readPin(0x29) }; }
  // Bordas: alimenta INT0/INT1, PCINT e as medições de pulso (servo, tone).
  levelsChanged() {
    const now = this.portLevels(), prev = this.prevLevels || now, d = this.data;
    for (const port of ['B', 'C', 'D']) {
      const diff = now[port] ^ prev[port]; if (!diff) continue;
      const pcmsk = port === 'B' ? 0x6b : port === 'C' ? 0x6c : 0x6d, pcif = port === 'B' ? 1 : port === 'C' ? 2 : 4;
      if (diff & d[pcmsk]) d[0x3b] |= pcif;
      for (let b = 0; b < 8; b++) {
        if (!(diff & (1 << b))) continue;
        const name = port === 'B' ? `D${b + 8}` : port === 'C' ? `A${b}` : `D${b}`, level = (now[port] >> b) & 1, t = this.cycles;
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
      if (port === 'D') for (const [bit, flag, shift] of [[2, 1, 0], [3, 2, 2]]) {
        if (!(diff & (1 << bit))) continue;
        const isc = (d[0x69] >> shift) & 3, level = (now.D >> bit) & 1;
        if (isc === 1 || (isc === 2 && !level) || (isc === 3 && level)) d[0x3c] |= flag;
      }
    }
    this.prevLevels = now; this.irqCheckAt = 0;
  }
  pinsChanged() {
    this.levelsChanged();
    if (!this.onPinChange) return;
    const now = this.pinSnapshot(), changed = {};
    for (const k in now) { const a = now[k], b = this.lastPins[k]; if (!b || a.level !== b.level || a.mode !== b.mode || a.duty !== b.duty) changed[k] = a; }
    this.lastPins = now;
    if (Object.keys(changed).length) this.onPinChange(changed, this.cycles / CLOCK, now);
  }

  // ---------- timers ----------
  prescale(cs, t2 = false) { return t2 ? [0, 1, 8, 32, 64, 128, 256, 1024][cs & 7] : [0, 1, 8, 64, 256, 1024, 0, 0][cs & 7]; }
  syncTimers() {
    const now = this.cycles;
    const dt = now - (this.timerSync ?? 0); this.timerSync = now; if (dt <= 0) return;
    this.tick8(this.t0, 0x44, 0x45, 0x46, 0x47, 0x48, 0x35, dt, false);
    this.tick16(dt);
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
  tick16(dt) {
    const pre = this.prescale(this.data[0x81]); if (!pre) return; const st = this.t1;
    st.acc += dt; let ticks = Math.floor(st.acc / pre); st.acc -= ticks * pre; if (!ticks) return;
    const wgm = (this.data[0x80] & 3) | ((this.data[0x81] >> 1) & 0xc);
    const ocra = this.data[0x88] | (this.data[0x89] << 8), ocrb = this.data[0x8a] | (this.data[0x8b] << 8), icr = this.data[0x86] | (this.data[0x87] << 8);
    const tops = { 0: 0xffff, 1: 0xff, 2: 0x1ff, 3: 0x3ff, 4: ocra, 5: 0xff, 6: 0x1ff, 7: 0x3ff, 8: icr, 9: ocra, 10: icr, 11: ocra, 12: icr, 14: icr, 15: ocra };
    const top = tops[wgm] ?? 0xffff, phase = [1, 2, 3, 8, 9, 10, 11].includes(wgm);
    let cnt = this.data[0x84] | (this.data[0x85] << 8);
    const period = phase ? 2 * top : top + 1;
    if (ticks > 4 * period + 4) { ticks -= Math.floor((ticks - 2 * period) / period) * period; }
    for (; ticks > 0; ticks--) {
      if (phase) { cnt += st.dir || 1; if (cnt >= top) { cnt = top; st.dir = -1; } if (cnt <= 0) { cnt = 0; st.dir = 1; this.data[0x36] |= 1; } }
      else if (cnt >= top) { cnt = 0; if (wgm === 0 || wgm >= 5) this.data[0x36] |= 1; }
      else cnt++;
      if (cnt === ocra) this.data[0x36] |= 2;
      if (cnt === ocrb) this.data[0x36] |= 4;
    }
    this.data[0x84] = cnt & 0xff; this.data[0x85] = (cnt >> 8) & 0xff;
  }

  // ---------- USART0 ----------
  frameCycles() { const ubrr = this.data[0xc4] | ((this.data[0xc5] & 0x0f) << 8); const div = (this.data[0xc0] & 2) ? 8 : 16; return Math.max(1, 10 * div * (ubrr + 1)); }
  uartWrite(v) {
    this.syncUart(); const u = this.uart;
    if (this.cycles >= u.busyUntil && u.pending === null) { this.emit(v); u.busyUntil = this.cycles + this.frameCycles(); }
    else u.pending = v;
    u.txc = false; u.txcLatched = false;
  }
  emit(v) { this.onSerial?.(v); }
  syncUart() {
    const u = this.uart;
    if (u.pending !== null && this.cycles >= u.busyUntil) { this.emit(u.pending); u.busyUntil += this.frameCycles(); u.pending = null; }
    if (u.pending === null && u.busyUntil > 0 && this.cycles >= u.busyUntil && !u.txcLatched) { u.txc = true; u.txcLatched = true; }
    if (!u.rxReady && u.rx.length && this.cycles >= u.rxNextAt && (this.data[0xc1] & 0x10)) { u.rxData = u.rx.shift(); u.rxReady = true; u.rxNextAt = this.cycles + this.frameCycles(); }
  }
  serialInput(text) { for (const ch of new TextEncoder().encode(String(text))) this.uart.rx.push(ch); }

  // ---------- ADC ----------
  adcStart() { const adps = this.data[0x7a] & 7, pre = adps < 2 ? 2 : 1 << adps; this.adc.doneAt = this.cycles + 13 * pre; }
  syncAdc() {
    if (this.adc.doneAt < 0 || this.cycles < this.adc.doneAt) return;
    this.adc.doneAt = -1;
    const mux = this.data[0x7c] & 0x0f, vref = 5, volts = mux < 8 ? this.analog[mux] : mux === 0x0e ? 1.1 : 0;
    let value = Math.max(0, Math.min(1023, Math.round(volts / vref * 1023)));
    if (this.data[0x7c] & 0x20) { this.data[0x79] = value >> 2; this.data[0x78] = (value & 3) << 6; } else { this.data[0x78] = value & 0xff; this.data[0x79] = value >> 8; }
    this.data[0x7a] = (this.data[0x7a] & ~0x40) | 0x10;
  }

  // ---------- interrupções ----------
  pendingVector() {
    this.syncTimers(); this.syncUart(); this.syncAdc(); this.syncWdt(); this.syncSpi(); this.syncTwi(); this.syncEeprom();
    const d = this.data, eimsk = d[0x3d], pc = d[0x68] & d[0x3b];
    const lowLevel = bit => !((this.readPin(0x29) >> bit) & 1);
    if ((eimsk & 1) && ((d[0x3c] & 1) || ((d[0x69] & 3) === 0 && lowLevel(2)))) return [VEC.INT0, 0x3c, 1];
    if ((eimsk & 2) && ((d[0x3c] & 2) || (((d[0x69] >> 2) & 3) === 0 && lowLevel(3)))) return [VEC.INT1, 0x3c, 2];
    if (pc & 1) return [VEC.PCINT0, 0x3b, 1]; if (pc & 2) return [VEC.PCINT1, 0x3b, 2]; if (pc & 4) return [VEC.PCINT2, 0x3b, 4];
    if ((d[0x60] & 0xc0) === 0xc0) return [VEC.WDT, 0x60, 0x80];
    const t0 = d[0x35] & d[0x6e], t1 = d[0x36] & d[0x6f], t2 = d[0x37] & d[0x70];
    if (t2 & 2) return [VEC.TIMER2_COMPA, 0x37, 2]; if (t2 & 4) return [VEC.TIMER2_COMPB, 0x37, 4]; if (t2 & 1) return [VEC.TIMER2_OVF, 0x37, 1];
    if (t1 & 2) return [VEC.TIMER1_COMPA, 0x36, 2]; if (t1 & 4) return [VEC.TIMER1_COMPB, 0x36, 4]; if (t1 & 1) return [VEC.TIMER1_OVF, 0x36, 1];
    if (t0 & 2) return [VEC.TIMER0_COMPA, 0x35, 2]; if (t0 & 4) return [VEC.TIMER0_COMPB, 0x35, 4]; if (t0 & 1) return [VEC.TIMER0_OVF, 0x35, 1];
    const b = d[0xc1];
    if ((b & 0x80) && this.uart.rxReady) return [VEC.USART_RX, 0, 0];
    if ((b & 0x20) && this.uart.pending === null) return [VEC.USART_UDRE, 0, 0];
    if ((b & 0x40) && this.uart.txc) return [VEC.USART_TX, -1, 0];
    if ((d[0x7a] & 0x08) && (d[0x7a] & 0x10)) return [VEC.ADC, 0x7a, 0x10];
    if ((d[0x3f] & 0x08) && !(d[0x3f] & 0x02)) return [VEC.EE_READY, 0, 0];
    if ((d[0xbc] & 0x81) === 0x81) return [VEC.TWI, 0, 0]; // TWINT não é limpo pela entrada na ISR
    if ((d[0x4c] & 0x80) && (d[0x4d] & 0x80)) return [VEC.SPI_STC, 0x4d, 0x80];
    return null;
  }
  serviceInterrupt() {
    const v = this.pendingVector(); if (!v) return false;
    const [vec, flagReg, mask] = v;
    if (flagReg > 0) this.data[flagReg] &= ~mask; else if (flagReg === -1) this.uart.txc = false;
    if (vec === VEC.WDT && (this.data[0x60] & 0x08)) this.data[0x60] &= ~0x40; // modo interrupção+reset: próxima vez reinicia
    this.sleeping = false;
    this.push16(this.pc); this.data[SREG] &= ~(1 << I); this.pc = vec * 2; this.cycles += 4;
    return true;
  }

  // ---------- pilha ----------
  push8(v) { const sp = this.sp; this.data[sp] = v; this.sp = sp - 1; }
  pop8() { const sp = this.sp + 1; this.sp = sp; return this.data[sp]; }
  push16(v) { this.push8(v & 0xff); this.push8((v >> 8) & 0xff); }
  pop16() { const hi = this.pop8(), lo = this.pop8(); return (hi << 8) | lo; }

  // ---------- execução ----------
  run(cycles) {
    const end = this.cycles + cycles;
    // Interrupções são verificadas a cada 16 ciclos (1 µs) ou logo após escrita em E/S, SEI e RETI.
    while (this.cycles < end && !this.halted) {
      if (this.sleeping) { this.sleepUntil(end); continue; }
      if (this.cycles >= this.irqCheckAt) {
        this.irqCheckAt = this.cycles + 16;
        if ((this.data[SREG] & 0x80) && !this.interruptDelay && this.serviceInterrupt()) continue;
      }
      if (this.interruptDelay) { this.interruptDelay--; this.irqCheckAt = 0; }
      this.step();
    }
    this.syncTimers(); this.syncUart(); this.syncAdc(); this.syncWdt();
  }
  runSeconds(s) { this.run(Math.round(s * CLOCK)); }
  get time() { return this.cycles / CLOCK; }

  // ---------- sleep ----------
  sleepUntil(end) {
    const deep = this.sleeping !== 'idle' && this.sleeping !== 'adc';
    if (deep) { // timers 0/1 param; acorda por WDT, INT0/INT1 (nível), PCINT ou TWI
      this.syncTimers(); const wdtAt = this.wdtDueAt(); const target = Math.min(end, wdtAt >= 0 ? wdtAt : end);
      this.cycles = Math.max(this.cycles + 1, target); this.timerSync = this.cycles; this.uart.busyUntil = Math.min(this.uart.busyUntil, this.cycles);
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
    this.syncEeprom(); const addr = (this.data[0x41] | (this.data[0x42] << 8)) & 0x3ff;
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
    if (!(v & 0x04)) { t.phase = 'idle'; t.device = null; t.doneAt = -1; d[0xb9] = (d[0xb9] & 3) | 0xf8; return; }
    if (!(v & 0x80)) return;
    const status = st => () => { d[0xb9] = (d[0xb9] & 3) | st; d[0xbc] |= 0x80; };
    if (v & 0x10) { // STOP
      t.apply = () => { t.device?.stop?.(); t.device = null; t.phase = 'idle'; d[0xbc] &= ~0x10; d[0xb9] = (d[0xb9] & 3) | 0xf8; if (v & 0x20) { t.phase = 'start'; status(0x08)(); } };
      t.doneAt = this.cycles + this.twiByteCycles(1); return;
    }
    if (v & 0x20) { // START ou START repetido
      const repeated = t.phase !== 'idle'; if (repeated) t.device?.stop?.();
      t.apply = () => { t.phase = 'start'; t.device = null; status(repeated ? 0x10 : 0x08)(); d[0xbc] &= ~0x20; };
      t.doneAt = this.cycles + this.twiByteCycles(1); return;
    }
    if (t.phase === 'start') { // endereço + R/W
      const sla = d[0xbb], dev = this.i2c.get(sla >> 1), read = sla & 1;
      const ack = !!dev && dev.start?.(!!read) !== false;
      t.apply = () => { t.device = ack ? dev : null; t.read = !!read; t.phase = ack ? (read ? 'mr' : 'mt') : 'nack'; status(read ? (ack ? 0x40 : 0x48) : (ack ? 0x18 : 0x20))(); };
    } else if (t.phase === 'mt') {
      const ack = t.device ? t.device.write?.(d[0xbb]) !== false : false;
      t.apply = status(ack ? 0x28 : 0x30);
    } else if (t.phase === 'mr') {
      const byte = t.device?.read?.() ?? 0xff, ackOut = !!(v & 0x40);
      t.apply = () => { d[0xbb] = byte & 0xff; status(ackOut ? 0x50 : 0x58)(); };
    } else { t.apply = status(0xf8); }
    t.doneAt = this.cycles + this.twiByteCycles(9);
  }
  syncTwi() { const t = this.twi; if (t.doneAt >= 0 && this.cycles >= t.doneAt) { t.doneAt = -1; const f = t.apply; t.apply = null; f?.(); this.irqCheckAt = 0; } }

  flags(mask, values) { this.data[SREG] = (this.data[SREG] & ~mask) | values; }
  step() {
    const d = this.data, op = this.prog[this.pc & 0x3fff];
    const pc = this.pc; this.pc = (pc + 1) & 0x3fff;
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
      case 0xc: { this.pc = (this.pc + ((op << 20) >> 20)) & 0x3fff; this.cycles += 2; return; } // RJMP
      case 0xd: { this.push16(this.pc); this.pc = (this.pc + ((op << 20) >> 20)) & 0x3fff; this.cycles += 3; return; } // RCALL
      case 0xe: { d[16 + ((op >> 4) & 0xf)] = ((op >> 4) & 0xf0) | (op & 0xf); this.cycles++; return; } // LDI
      case 0xf: {
        const sub = (op >> 9) & 7, bit = op & 7;
        if (sub <= 3) { // BRBS/BRBC
          const set = (sreg >> bit) & 1, want = (op & 0x400) ? 0 : 1;
          if (set === want) { this.pc = (this.pc + (((op >> 3) << 25) >> 25)) & 0x3fff; this.cycles += 2; } else this.cycles++;
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
        case 0x0: { const addr = this.prog[this.pc]; this.pc = (this.pc + 1) & 0x3fff; mem(addr); this.cycles += 2; return; } // LDS/STS
        case 0x1: { const a = Zr(); mem(a); setW(30, a + 1); this.cycles += 2; return; }
        case 0x2: { const a = (Zr() - 1) & 0xffff; setW(30, a); mem(a); this.cycles += 2; return; }
        case 0x4: case 0x5: if (!store) { const z = Zr(); d[rd5] = this.flashBytes[z & 0x7fff]; if (mode === 5) setW(30, z + 1); this.cycles += 3; return; } break; // LPM
        case 0x6: case 0x7: if (!store) { const z = Zr(); d[rd5] = this.flashBytes[z & 0x7fff]; if (mode === 7) setW(30, z + 1); this.cycles += 3; return; } break; // ELPM
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
      case 0x9508: this.pc = this.pop16() & 0x3fff; this.cycles += 4; return; // RET
      case 0x9518: this.pc = this.pop16() & 0x3fff; d[SREG] |= 0x80; this.interruptDelay = 1; this.cycles += 4; return; // RETI
      case 0x9588: this.cycles++; if (this.data[0x53] & 1) this.sleeping = ['idle', 'adc', 'power-down', 'power-save', '?', '?', 'standby', 'ext-standby'][(this.data[0x53] >> 1) & 7]; return; // SLEEP
      case 0x95a8: this.wdt.last = this.cycles; this.cycles++; return; // WDR
      case 0x95e8: case 0x95f8: this.cycles++; return; // SPM
      case 0x9598: this.halted = true; this.lastError = 'BREAK'; return;
      case 0x95c8: d[0] = this.flashBytes[(d[30] | (d[31] << 8)) & 0x7fff]; this.cycles += 3; return; // LPM r0
      case 0x95d8: d[0] = this.flashBytes[(d[30] | (d[31] << 8)) & 0x7fff]; this.cycles += 3; return;
      case 0x9409: this.pc = d[30] | (d[31] << 8); this.cycles += 2; return; // IJMP
      case 0x9509: this.push16(this.pc); this.pc = d[30] | (d[31] << 8); this.cycles += 3; return; // ICALL
    }
    if ((op & 0xfe0e) === 0x940c || (op & 0xfe0e) === 0x940e) { // JMP / CALL
      const k = (((op >> 3) & 0x3e) | (op & 1)) << 16 | this.prog[this.pc]; this.pc = (this.pc + 1) & 0x3fff;
      if (op & 2) { this.push16(this.pc); this.cycles += 4; } else this.cycles += 3;
      this.pc = k & 0x3fff; return;
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
  ioPortValue(a) { return (a === 0x23 || a === 0x26 || a === 0x29) ? 0 : this.read(a); }
  skip() { const next = this.prog[this.pc]; const two = (next & 0xfe0f) === 0x9000 || (next & 0xfe0f) === 0x9200 || (next & 0xfe0e) === 0x940c || (next & 0xfe0e) === 0x940e; this.pc = (this.pc + (two ? 2 : 1)) & 0x3fff; this.cycles += two ? 2 : 1; }
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
