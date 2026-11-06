// Emulador do ATmega328P (Arduino Uno) escrito para o Hardware Studio.
// Referências: Microchip "AVR Instruction Set Manual" (DS40002198) e datasheet ATmega328P (DS40002061).
// Escopo: núcleo AVR completo do 328P, interrupções com vetores reais, GPIO B/C/D, Timer0/1/2 (contagem,
// comparação, overflow e PWM por registradores), USART0 (TX/RX com tempo de quadro), ADC e Intel HEX.
// Fora do escopo por enquanto: EEPROM, SPI, TWI, watchdog, sleep real e consumo elétrico.

export const CLOCK = 16_000_000;
const SREG = 0x5f, SPL = 0x5d, SPH = 0x5e;
const C = 0, Z = 1, N = 2, V = 3, S = 4, H = 5, T = 6, I = 7;
// Vetores de interrupção do 328P (número do vetor; endereço em palavras = número × 2).
export const VEC = { INT0: 1, INT1: 2, PCINT0: 3, PCINT1: 4, PCINT2: 5, WDT: 6, TIMER2_COMPA: 7, TIMER2_COMPB: 8, TIMER2_OVF: 9, TIMER1_CAPT: 10, TIMER1_COMPA: 11, TIMER1_COMPB: 12, TIMER1_OVF: 13, TIMER0_COMPA: 14, TIMER0_COMPB: 15, TIMER0_OVF: 16, SPI_STC: 17, USART_RX: 18, USART_UDRE: 19, USART_TX: 20, ADC: 21 };

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
    this.reset();
  }
  reset() {
    this.data.fill(0); this.pc = 0; this.cycles = 0; this.halted = false; this.lastError = null;
    this.sp = 0x8ff; this.interruptDelay = 0; this.irqCheckAt = 0;
    this.t0 = { acc: 0, flags: 0 }; this.t1 = { acc: 0, dir: 1 }; this.t2 = { acc: 0, dir: 1 };
    this.uart = { busyUntil: 0, pending: null, txc: false, rx: [], rxNextAt: 0, rxData: 0, rxReady: false };
    this.adc = { doneAt: -1 };
    this.data[0xc0] = 0x20; // UDRE0 vazio
    this.lastPins = this.pinSnapshot();
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
  setInput(pinName, level) { const [port, bit] = UNO_PINS[pinName]; this.inputs[port][bit] = level === null ? null : level ? 1 : 0; }

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
  pinsChanged() {
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
    this.syncTimers(); this.syncUart(); this.syncAdc();
    const d = this.data;
    const t0 = d[0x35] & d[0x6e], t1 = d[0x36] & d[0x6f], t2 = d[0x37] & d[0x70];
    if (t2 & 2) return [VEC.TIMER2_COMPA, 0x37, 2]; if (t2 & 4) return [VEC.TIMER2_COMPB, 0x37, 4]; if (t2 & 1) return [VEC.TIMER2_OVF, 0x37, 1];
    if (t1 & 2) return [VEC.TIMER1_COMPA, 0x36, 2]; if (t1 & 4) return [VEC.TIMER1_COMPB, 0x36, 4]; if (t1 & 1) return [VEC.TIMER1_OVF, 0x36, 1];
    if (t0 & 2) return [VEC.TIMER0_COMPA, 0x35, 2]; if (t0 & 4) return [VEC.TIMER0_COMPB, 0x35, 4]; if (t0 & 1) return [VEC.TIMER0_OVF, 0x35, 1];
    const b = d[0xc1];
    if ((b & 0x80) && this.uart.rxReady) return [VEC.USART_RX, 0, 0];
    if ((b & 0x20) && this.uart.pending === null) return [VEC.USART_UDRE, 0, 0];
    if ((b & 0x40) && this.uart.txc) return [VEC.USART_TX, -1, 0];
    if ((d[0x7a] & 0x08) && (d[0x7a] & 0x10)) return [VEC.ADC, 0x7a, 0x10];
    return null;
  }
  serviceInterrupt() {
    const v = this.pendingVector(); if (!v) return false;
    const [vec, flagReg, mask] = v;
    if (flagReg > 0) this.data[flagReg] &= ~mask; else if (flagReg === -1) this.uart.txc = false;
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
      if (this.cycles >= this.irqCheckAt) {
        this.irqCheckAt = this.cycles + 16;
        if ((this.data[SREG] & 0x80) && !this.interruptDelay && this.serviceInterrupt()) continue;
      }
      if (this.interruptDelay) { this.interruptDelay--; this.irqCheckAt = 0; }
      this.step();
    }
    this.syncTimers(); this.syncUart(); this.syncAdc();
  }
  runSeconds(s) { this.run(Math.round(s * CLOCK)); }
  get time() { return this.cycles / CLOCK; }

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
      case 0x9588: case 0x95a8: case 0x95e8: case 0x95f8: this.cycles++; return; // SLEEP, WDR, SPM
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
