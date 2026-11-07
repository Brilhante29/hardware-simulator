// Dispositivos I²C emulados para o barramento do ATmega328P.
// Interface: start(read) → ack; write(byte) → ack; read() → byte; stop().

// LCD 16×2/20×4 com "mochila" PCF8574 (endereço 0x27 ou 0x3F) e controlador HD44780.
// Mapa do PCF8574 usado pelas bibliotecas comuns: P0=RS, P1=RW, P2=EN, P3=luz de fundo, P4..P7=D4..D7.
export class LcdI2C {
  constructor({ address = 0x27, cols = 16, rows = 2 } = {}) {
    this.address = address; this.cols = cols; this.rows = rows;
    this.ddram = new Uint8Array(128).fill(0x20); this.cgram = new Uint8Array(64);
    this.addr = 0; this.cg = false; this.inc = 1; this.shiftDisplay = false; this.offset = 0;
    this.display = false; this.cursor = false; this.blink = false; this.backlight = false;
    this.fourBit = false; this.half = null; this.port = 0xff; this.version = 0;
  }
  start() { return true; }
  stop() {}
  read() { return this.port; }
  write(byte) {
    const prev = this.port; this.port = byte; this.backlight = !!(byte & 0x08);
    if ((prev & 0x04) && !(byte & 0x04)) this.latch(prev); // borda de descida em EN
    this.version++; return true;
  }
  latch(bits) {
    const rs = bits & 1, rw = bits & 2, nibble = bits >> 4;
    if (rw) return;
    if (!this.fourBit) { this.exec(rs, nibble << 4); return; } // modo 8 bits na inicialização: só o nibble alto conta
    if (this.half === null) { this.half = nibble; return; }
    const value = (this.half << 4) | nibble; this.half = null; this.exec(rs, value);
  }
  exec(rs, v) {
    if (rs) { // dado
      if (this.cg) { this.cgram[this.addr & 63] = v & 0x1f; this.addr = (this.addr + 1) & 63; }
      else { this.ddram[this.addr & 127] = v; this.addr = (this.addr + this.inc) & 127; if (this.shiftDisplay) this.offset += this.inc; }
      return;
    }
    if (v & 0x80) { this.cg = false; this.addr = v & 0x7f; return; }
    if (v & 0x40) { this.cg = true; this.addr = v & 0x3f; return; }
    if (v & 0x20) { this.fourBit = !(v & 0x10); this.half = null; return; }
    if (v & 0x10) { if (v & 0x08) this.offset += (v & 0x04) ? -1 : 1; else this.addr = (this.addr + ((v & 0x04) ? 1 : -1)) & 127; return; }
    if (v & 0x08) { this.display = !!(v & 4); this.cursor = !!(v & 2); this.blink = !!(v & 1); return; }
    if (v & 0x04) { this.inc = (v & 2) ? 1 : -1; this.shiftDisplay = !!(v & 1); return; }
    if (v & 0x02) { this.addr = 0; this.offset = 0; this.cg = false; return; }
    if (v & 0x01) { this.ddram.fill(0x20); this.addr = 0; this.offset = 0; this.inc = 1; this.cg = false; }
  }
  lines() {
    const starts = [0x00, 0x40, 0x14, 0x54], out = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        const base = starts[r] < 0x40 ? 0 : 0x40, len = 40, idx = base + ((starts[r] - base + c + this.offset) % len + len) % len;
        const ch = this.ddram[idx]; line += ch < 8 ? '▒' : ch >= 0x20 && ch < 0x7f ? String.fromCharCode(ch) : ch === 0xdf ? '°' : '█';
      }
      out.push(this.display ? line : ' '.repeat(this.cols));
    }
    return out;
  }
}

// OLED SSD1306 128×64 (endereço 0x3C/0x3D) — modos de endereçamento horizontal, vertical e por página.
export class Ssd1306 {
  constructor({ address = 0x3c, width = 128, height = 64 } = {}) {
    this.address = address; this.width = width; this.height = height; this.pages = height / 8;
    this.ram = new Uint8Array(width * this.pages); this.on = false; this.invert = false; this.contrast = 0x7f;
    this.mode = 2; this.col = 0; this.page = 0; this.colStart = 0; this.colEnd = width - 1; this.pageStart = 0; this.pageEnd = this.pages - 1;
    this.expect = 'control'; this.cmd = []; this.need = 0; this.continuation = false; this.dataMode = false; this.version = 0;
  }
  start(read) { this.expect = 'control'; return !read; }
  stop() { this.expect = 'control'; }
  read() { return 0; }
  write(b) {
    if (this.expect === 'control') { this.continuation = !!(b & 0x80); this.dataMode = !!(b & 0x40); this.expect = 'payload'; return true; }
    if (this.dataMode) this.data(b); else this.command(b);
    if (this.continuation) this.expect = 'control';
    return true;
  }
  command(b) {
    if (this.need) { this.cmd.push(b); if (--this.need === 0) this.finish(); return; }
    this.cmd = [b];
    const params = { 0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1, 0xa3: 2, 0x26: 6, 0x27: 6, 0x29: 5, 0x2a: 5 }[b];
    if (params) { this.need = params; return; }
    if (b === 0xae) this.on = false; else if (b === 0xaf) this.on = true;
    else if (b === 0xa6) this.invert = false; else if (b === 0xa7) this.invert = true;
    else if (b >= 0xb0 && b <= 0xb7) this.page = b & 7;
    else if (b <= 0x0f) this.col = (this.col & 0xf0) | b;
    else if (b >= 0x10 && b <= 0x1f) this.col = ((b & 0x0f) << 4) | (this.col & 0x0f);
    this.version++;
  }
  finish() {
    const [c, a, b] = this.cmd;
    if (c === 0x20) this.mode = a & 3;
    else if (c === 0x21) { this.colStart = a & 0x7f; this.colEnd = b & 0x7f; this.col = this.colStart; }
    else if (c === 0x22) { this.pageStart = a & 7; this.pageEnd = Math.min(b & 7, this.pages - 1); this.page = this.pageStart; }
    else if (c === 0x81) this.contrast = a;
    this.version++;
  }
  data(b) {
    this.ram[this.page * this.width + this.col] = b; this.version++;
    if (this.mode === 0) { if (++this.col > this.colEnd) { this.col = this.colStart; if (++this.page > this.pageEnd) this.page = this.pageStart; } }
    else if (this.mode === 1) { if (++this.page > this.pageEnd) { this.page = this.pageStart; if (++this.col > this.colEnd) this.col = this.colStart; } }
    else this.col = Math.min(this.width - 1, this.col + 1);
  }
  pixel(x, y) { const on = (this.ram[(y >> 3) * this.width + x] >> (y & 7)) & 1; return this.invert ? !on : !!on; }
  // Texto ASCII para testes e terminal: '#' aceso, '.' apagado (reduzido 2×).
  ascii(step = 2) { const rows = []; for (let y = 0; y < this.height; y += step) { let r = ''; for (let x = 0; x < this.width; x += step) r += this.pixel(x, y) ? '#' : '.'; rows.push(r); } return rows.join('\n'); }
}

// Base para sensores com ponteiro de registrador: 1º byte escrito = endereço; depois lê/escreve em sequência.
class RegisterDevice {
  constructor(address) { this.address = address; this.reg = new Uint8Array(256); this.ptr = 0; this.fresh = true; this.version = 0; }
  attach(mcu) { this.mcu = mcu; }
  get time() { return this.mcu ? this.mcu.time : 0; }
  start(read) { if (read) this.prepareRead?.(); this.fresh = !read; return true; }
  stop() { this.onStop?.(); }
  write(b) { if (this.fresh) { this.ptr = b; this.fresh = false; return true; } this.writeReg(this.ptr, b); this.ptr = (this.ptr + 1) & 0xff; this.version++; return true; }
  writeReg(r, v) { this.reg[r] = v; }
  read() { const v = this.readReg(this.ptr); this.ptr = (this.ptr + 1) & 0xff; return v; }
  readReg(r) { return this.reg[r]; }
}

// BME280 (Bosch, endereço 0x76/0x77): temperatura, pressão e umidade com as fórmulas de compensação do datasheet.
const BME_CAL = { T1: 27504, T2: 26435, T3: -1000, P1: 36477, P2: -10685, P3: 3024, P4: 2855, P5: 140, P6: -7, P7: 15500, P8: -14600, P9: 6000, H1: 75, H2: 370, H3: 0, H4: 313, H5: 50, H6: 30 };
export class Bme280 extends RegisterDevice {
  constructor({ address = 0x76, temperature = 24, pressure = 1013.25, humidity = 55 } = {}) {
    super(address); Object.assign(this, { temperature, pressure, humidity });
    const c = BME_CAL, r = this.reg, u16 = (a, v) => { r[a] = v & 0xff; r[a + 1] = (v >> 8) & 0xff; };
    [c.T1, c.T2, c.T3, c.P1, c.P2, c.P3, c.P4, c.P5, c.P6, c.P7, c.P8, c.P9].forEach((v, i) => u16(0x88 + i * 2, v));
    r[0xa1] = c.H1; u16(0xe1, c.H2); r[0xe3] = c.H3; r[0xe4] = (c.H4 >> 4) & 0xff; r[0xe5] = (c.H4 & 0x0f) | ((c.H5 & 0x0f) << 4); r[0xe6] = (c.H5 >> 4) & 0xff; r[0xe7] = c.H6 & 0xff;
    r[0xd0] = 0x60;
  }
  static compT(adc) { const c = BME_CAL, a = BigInt(adc); const v1 = (((a >> 3n) - (BigInt(c.T1) << 1n)) * BigInt(c.T2)) >> 11n; const d = (a >> 4n) - BigInt(c.T1); const v2 = (((d * d) >> 12n) * BigInt(c.T3)) >> 14n; const tf = v1 + v2; return { tFine: tf, t: Number((tf * 5n + 128n) >> 8n) / 100 }; }
  static compP(adc, tFine) {
    const c = BME_CAL; let v1 = tFine - 128000n, v2 = v1 * v1 * BigInt(c.P6); v2 += (v1 * BigInt(c.P5)) << 17n; v2 += BigInt(c.P4) << 35n;
    v1 = ((v1 * v1 * BigInt(c.P3)) >> 8n) + ((v1 * BigInt(c.P2)) << 12n); v1 = (((1n << 47n) + v1) * BigInt(c.P1)) >> 33n; if (v1 === 0n) return 0;
    let p = 1048576n - BigInt(adc); p = (((p << 31n) - v2) * 3125n) / v1; v1 = (BigInt(c.P9) * (p >> 13n) * (p >> 13n)) >> 25n; v2 = (BigInt(c.P8) * p) >> 19n; p = ((p + v1 + v2) >> 8n) + (BigInt(c.P7) << 4n);
    return Number(p) / 256;
  }
  static compH(adc, tFine) {
    const c = BME_CAL; let v = tFine - 76800n;
    v = ((((BigInt(adc) << 14n) - (BigInt(c.H4) << 20n) - (BigInt(c.H5) * v)) + 16384n) >> 15n) * (((((((v * BigInt(c.H6)) >> 10n) * (((v * BigInt(c.H3)) >> 11n) + 32768n)) >> 10n) + 2097152n) * BigInt(c.H2) + 8192n) >> 14n);
    v = v - (((((v >> 15n) * (v >> 15n)) >> 7n) * BigInt(c.H1)) >> 4n); v = v < 0n ? 0n : v > 419430400n ? 419430400n : v; return Number(v >> 12n) / 1024;
  }
  static search(lo, hi, f, target, increasing) { while (lo < hi) { const m = (lo + hi) >> 1; const v = f(m); if (increasing ? v < target : v > target) lo = m + 1; else hi = m; } return lo; }
  prepareRead() {
    const adcT = Bme280.search(0, (1 << 20) - 1, a => Bme280.compT(a).t, this.temperature, true), tFine = Bme280.compT(adcT).tFine;
    const adcP = Bme280.search(0, (1 << 20) - 1, a => Bme280.compP(a, tFine), this.pressure * 100, false);
    const adcH = Bme280.search(0, 65535, a => Bme280.compH(a, tFine), this.humidity, true);
    const r = this.reg; r[0xf7] = adcP >> 12; r[0xf8] = (adcP >> 4) & 0xff; r[0xf9] = (adcP & 0xf) << 4; r[0xfa] = adcT >> 12; r[0xfb] = (adcT >> 4) & 0xff; r[0xfc] = (adcT & 0xf) << 4; r[0xfd] = adcH >> 8; r[0xfe] = adcH & 0xff;
  }
  writeReg(r, v) { if (r === 0xe0) return; if (r === 0xf3) return; this.reg[r] = v; }
  readReg(r) { return r === 0xf3 ? 0 : this.reg[r]; }
}

// MPU-6050 (InvenSense, 0x68/0x69): acelerômetro, giroscópio e temperatura em big-endian a partir de 0x3B.
export class Mpu6050 extends RegisterDevice {
  constructor({ address = 0x68, accel = [0, 0, 1], gyro = [0, 0, 0], temperature = 25 } = {}) { super(address); Object.assign(this, { accel, gyro, temperature }); this.resetRegs(); }
  resetRegs() { this.reg.fill(0); this.reg[0x6b] = 0x40; this.reg[0x75] = 0x68; }
  writeReg(r, v) { if (r === 0x6b && (v & 0x80)) { this.resetRegs(); return; } if (r === 0x75) return; this.reg[r] = v; }
  prepareRead() {
    const aScale = [16384, 8192, 4096, 2048][(this.reg[0x1c] >> 3) & 3], gScale = [131, 65.5, 32.8, 16.4][(this.reg[0x1b] >> 3) & 3];
    const s16 = (a, v) => { const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff; this.reg[a] = x >> 8; this.reg[a + 1] = x & 0xff; };
    const sleeping = this.reg[0x6b] & 0x40;
    this.accel.forEach((g, i) => s16(0x3b + i * 2, sleeping ? 0 : g * aScale));
    s16(0x41, sleeping ? 0 : (this.temperature - 36.53) * 340);
    this.gyro.forEach((d, i) => s16(0x43 + i * 2, sleeping ? 0 : d * gScale));
  }
}

// DS3231 (Maxim, 0x68): relógio em BCD que anda com o tempo simulado; flag OSF ligada no "primeiro boot".
export class Ds3231 extends RegisterDevice {
  constructor({ address = 0x68, start = Date.UTC(2026, 0, 1), temperature = 25 } = {}) { super(address); this.baseMs = start; this.baseT = 0; this.temperature = temperature; this.reg[0x0f] = 0x80; this.reg[0x0e] = 0x1c; this.pending = null; }
  nowMs() { return this.baseMs + (this.time - this.baseT) * 1000; }
  prepareRead() {
    const d = new Date(this.nowMs()), bcd = n => ((Math.floor(n / 10) << 4) | (n % 10));
    const r = this.reg; r[0] = bcd(d.getUTCSeconds()); r[1] = bcd(d.getUTCMinutes()); r[2] = bcd(d.getUTCHours()); r[3] = d.getUTCDay() || 7; r[4] = bcd(d.getUTCDate()); r[5] = bcd(d.getUTCMonth() + 1) | (d.getUTCFullYear() >= 2100 ? 0x80 : 0); r[6] = bcd(d.getUTCFullYear() % 100);
    const q = Math.round(this.temperature * 4); r[0x11] = (q >> 2) & 0xff; r[0x12] = (q & 3) << 6;
  }
  writeReg(r, v) { if (r <= 6) { this.prepareRead(); this.pending = this.pending || Array.from(this.reg.slice(0, 7)); this.pending[r] = v; return; } if (r === 0x0f) { this.reg[r] = v & 0x7f | (this.reg[r] & 0x80 & v); return; } this.reg[r] = v; }
  onStop() {
    if (!this.pending) return; const b = this.pending, dec = x => (x >> 4) * 10 + (x & 0xf); this.pending = null;
    this.baseMs = Date.UTC(2000 + dec(b[6]) + ((b[5] & 0x80) ? 100 : 0), dec(b[5] & 0x1f) - 1, dec(b[4] & 0x3f), dec(b[2] & 0x3f), dec(b[1] & 0x7f), dec(b[0] & 0x7f)); this.baseT = this.time;
  }
}

// BH1750 (ROHM, 0x23/0x5C): sensor de luz por comandos; leitura = lux × 1,2 (× 2 no modo H2).
export class Bh1750 {
  constructor({ address = 0x23, lux = 320 } = {}) { this.address = address; this.lux = lux; this.mode = 0x10; this.on = false; this.out = []; this.version = 0; }
  start(read) { if (read) { const mt = 69, k = (this.mode === 0x11 || this.mode === 0x21) ? 2 : 1, raw = Math.min(65535, Math.round(this.lux * 1.2 * k * (this.mtreg ?? mt) / mt)); this.out = this.on ? [raw >> 8, raw & 0xff] : [0, 0]; } return true; }
  write(c) { if (c === 0x00) this.on = false; else if (c === 0x01) this.on = true; else if (c === 0x07) {} else if ((c & 0xf8) === 0x40) this.mtHi = c & 7; else if ((c & 0xe0) === 0x60) this.mtreg = ((this.mtHi ?? 2) << 5) | (c & 0x1f); else { this.mode = c; this.on = true; } this.version++; return true; }
  read() { return this.out.shift() ?? 0; }
  stop() {}
}

// DHT11 / DHT22 (AM2302): sensor de um fio. Responde ao pulso de start do chip com o protocolo temporizado do datasheet:
// 80 µs baixo, 80 µs alto e 40 bits (50 µs baixo + 26 µs alto = 0, 70 µs alto = 1). O módulo tem pull-up externo.
export class Dht {
  constructor({ type = 22, temperature = 24, humidity = 55 } = {}) { this.type = type; this.temperature = temperature; this.humidity = humidity; this.lowStart = -1; this.reads = 0; }
  attach(mcu, pin) { this.mcu = mcu; this.pin = pin; mcu.setInput(pin, 1); }
  bytes() {
    const sum = a => [...a, a.reduce((x, y) => x + y, 0) & 0xff];
    if (this.type === 11) { const h = Math.max(0, Math.min(99, this.humidity)), t = Math.max(0, Math.min(50, this.temperature)); return sum([Math.floor(h), 0, Math.floor(t), Math.round((t % 1) * 10)]); }
    const h = Math.round(Math.max(0, Math.min(100, this.humidity)) * 10), t = Math.round(Math.abs(this.temperature) * 10) | (this.temperature < 0 ? 0x8000 : 0);
    return sum([h >> 8, h & 0xff, t >> 8, t & 0xff]);
  }
  onDrive({ output, level }) {
    const m = this.mcu;
    if (output && level === 0) { this.lowStart = m.cycles; return; }
    if (this.lowStart < 0) return;
    const lowUs = (m.cycles - this.lowStart) / 16; this.lowStart = -1;
    if (lowUs < (this.type === 11 ? 18000 : 800)) return; // start curto demais: o sensor ignora
    const us = 16, steps = [[0, 80], [1, 80]];
    for (const byte of this.bytes()) for (let b = 7; b >= 0; b--) steps.push([0, 50], [1, (byte >> b) & 1 ? 70 : 26]);
    steps.push([0, 50]);
    let t = m.cycles + 30 * us;
    for (const [level, dur] of steps) { const at = t; m.schedule(at, () => m.setInput(this.pin, level)); t += dur * us; }
    m.schedule(t, () => m.setInput(this.pin, 1)); this.reads++;
  }
}
