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
  // Código na DDRAM visível na linha r, coluna c (com o deslocamento do display).
  codeAt(r, c) { const starts = [0x00, 0x40, 0x14, 0x54], base = starts[r] < 0x40 ? 0 : 0x40, len = 40; return this.ddram[base + ((starts[r] - base + c + this.offset) % len + len) % len]; }
  // Caracteres criados (CGRAM, códigos 0–7 e o espelho 8–15) que estão na tela: { 'linha,coluna': [8 linhas de 5 bits] }.
  glyphs() {
    const out = {}; if (!this.display) return out;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const ch = this.codeAt(r, c); if (ch < 16) out[`${r},${c}`] = [...this.cgram.slice((ch & 7) * 8, (ch & 7) * 8 + 8)]; }
    return out;
  }
  lines() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        const ch = this.codeAt(r, c); line += ch < 16 ? '▒' : ch >= 0x20 && ch < 0x7f ? String.fromCharCode(ch) : ch === 0xdf ? '°' : '█';
      }
      out.push(this.display ? line : ' '.repeat(this.cols));
    }
    return out;
  }
}

// LCD HD44780 ligado direto nos pinos (biblioteca LiquidCrystal): mesmo controlador do LcdI2C, sem o PCF8574.
// pins: { rs, en, d: ['D5','D4','D3','D2'] } (D4–D7, 4 bits) ou 8 pinos (D0–D7). Liga-se com mcu.attachPinDevice(pins.en, lcd).
export class LcdParallel extends LcdI2C {
  constructor({ rs = 'D12', en = 'D11', d = ['D5', 'D4', 'D3', 'D2'], cols = 16, rows = 2 } = {}) {
    super({ cols, rows }); this.pins = { rs, en, d }; this.backlight = true; this.enLevel = 0;
  }
  attach(mcu) { this.mcu = mcu; }
  // Borda de descida no EN: o HD44780 lê RS e o barramento de dados.
  onDrive({ output, level }) {
    const en = output ? level : 0, prev = this.enLevel; this.enLevel = en;
    if (!prev || en) return;
    const lv = p => this.mcu.levelOf(p), rs = lv(this.pins.rs), d = this.pins.d.map(lv);
    if (d.length === 8) { this.exec(rs, d.reduce((a, b, i) => a | (b << i), 0)); this.version++; return; }
    this.latch(rs | (d[0] << 4) | (d[1] << 5) | (d[2] << 6) | (d[3] << 7)); this.version++;
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
  // Controles do catálogo: inclinação X/Y (°) vira o vetor da gravidade, giro Z em °/s, caminhada em passos/min.
  setControl(key, v) {
    this.ctl = { tiltX: 0, tiltY: 0, ...this.ctl, [key]: v };
    if (key === 'tiltX' || key === 'tiltY') { const tx = this.ctl.tiltX * Math.PI / 180, ty = this.ctl.tiltY * Math.PI / 180; this.accel = [Math.sin(ty), -Math.sin(tx), Math.cos(tx) * Math.cos(ty)]; this.fallAt = null; }
    else if (key === 'gyroZ') this.gyro = [0, 0, v]; else if (key === 'walk') this.walk = v; else this[key] = v;
  }
  // Evento de queda no tempo do chip: 0,3 s em queda livre, impacto de 3,5 g e o pulso deitado até a inclinação mudar.
  fall() { this.fallAt = this.time; }
  // Aceleração no instante da leitura: queda em andamento, caminhada (pico de ~1,6 g a cada passo) ou o vetor parado.
  motion() {
    if (this.fallAt != null) { const e = this.time - this.fallAt; return e < 0.3 ? [0, 0, 0.1] : e < 0.35 ? [0, 2.5, 2.5] : [1, 0, 0]; }
    if (this.walk) { const ph = (this.time * this.walk / 60) % 1, k = 1 + 0.6 * Math.max(0, Math.sin(2 * Math.PI * ph)); return this.accel.map(a => a * k); }
    return this.accel;
  }
  writeReg(r, v) { if (r === 0x6b && (v & 0x80)) { this.resetRegs(); return; } if (r === 0x75) return; this.reg[r] = v; }
  prepareRead() {
    const aScale = [16384, 8192, 4096, 2048][(this.reg[0x1c] >> 3) & 3], gScale = [131, 65.5, 32.8, 16.4][(this.reg[0x1b] >> 3) & 3];
    const s16 = (a, v) => { const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff; this.reg[a] = x >> 8; this.reg[a + 1] = x & 0xff; };
    const sleeping = this.reg[0x6b] & 0x40;
    this.motion().forEach((g, i) => s16(0x3b + i * 2, sleeping ? 0 : g * aScale));
    s16(0x41, sleeping ? 0 : (this.temperature - 36.53) * 340);
    this.gyro.forEach((d, i) => s16(0x43 + i * 2, sleeping ? 0 : d * gScale));
  }
}

// DS3231 (Maxim, 0x68): relógio em BCD que anda com o tempo simulado; flag OSF ligada no "primeiro boot".
export class Ds3231 extends RegisterDevice {
  // lostPower: módulo novo (OSF = 1, o RTClib.lostPower() acerta a hora); false = bateria CR2032 manteve a hora.
  constructor({ address = 0x68, start = Date.UTC(2026, 0, 1), temperature = 25, lostPower = true } = {}) { super(address); this.baseMs = start; this.baseT = 0; this.temperature = temperature; this.reg[0x0f] = lostPower ? 0x80 : 0; this.reg[0x0e] = 0x1c; this.pending = null; }
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

// Sensor ultrassônico HC-SR04 (datasheet ElecFreaks): pulso ≥ 10 µs no TRIG → rajada de 8 ciclos a 40 kHz e o ECHO sobe
// por todo o tempo de ida e volta do som. Velocidade do som c = 331,3 + 0,606·T m/s. Alcance 2–400 cm; sem eco, o ECHO
// fica alto ~38 ms. Enquanto mede, novos gatilhos são ignorados. Liga-se ao pino do TRIG: mcu.attachPinDevice(trig, sensor).
export class HcSr04 {
  constructor({ echo = 'D10', distanceCm = 100, temperatureC = 20 } = {}) { this.echo = echo; this.distanceCm = distanceCm; this.temperatureC = temperatureC; this.high = false; this.busy = false; this.pings = 0; }
  attach(mcu) { this.mcu = mcu; }
  // Tempo de ida e volta (µs) para a distância e temperatura atuais.
  echoUs() { const d = this.distanceCm; if (!(d >= 2 && d <= 400)) return 38000; return 2 * (d / 100) / (331.3 + 0.606 * this.temperatureC) * 1e6; }
  onDrive({ output, level }) {
    const m = this.mcu, lv = output && level === 1;
    if (lv && !this.high) this.riseAt = m.cycles;
    if (!lv && this.high && !this.busy && (m.cycles - this.riseAt) >= 160) this.fire();
    this.high = lv;
  }
  fire() {
    const m = this.mcu, start = m.cycles + 460 * 16, dur = Math.round(this.echoUs() * 16); this.busy = true; this.pings++;
    m.schedule(start, () => m.setInput(this.echo, 1));
    m.schedule(start + dur, () => m.setInput(this.echo, 0));
    m.schedule(start + dur + 200 * 16, () => { this.busy = false; });
  }
}

// GC9A01 (Galaxycore): tela redonda de 1,28" com 240 × 240 pontos RGB565 por SPI, a mais comum em relógios DIY.
// Escuta o SPI do chip quando o CS está em nível baixo; DC = 0 é comando, DC = 1 é dado. Implementa o conjunto MIPI DCS que
// as bibliotecas usam (CASET, RASET, RAMWR, MADCTL, SLPOUT, DISPON, INVON) e aceita os comandos de fábrica com parâmetros.
export class Gc9a01 {
  constructor({ cs = 'D10', dc = 'D9', rst = null, width = 240, height = 240 } = {}) {
    Object.assign(this, { cs, dc, rst, width, height }); this.fb = new Uint16Array(width * height); this.reset();
  }
  reset() { this.cmd = 0; this.args = []; this.xs = 0; this.xe = this.width - 1; this.ys = 0; this.ye = this.height - 1; this.x = 0; this.y = 0; this.half = -1; this.madctl = 0x48; this.on = false; this.sleep = true; this.invert = false; this.version = (this.version || 0) + 1; this.pixels = 0; }
  attach(mcu) {
    this.mcu = mcu; const prev = mcu.spiDevice;
    mcu.spiDevice = b => { if (mcu.levelOf(this.cs)) return prev ? prev(b) : 0xff; if (this.rst && !mcu.levelOf(this.rst)) { this.reset(); return 0xff; } this.byte(b, mcu.levelOf(this.dc)); return 0xff; };
  }
  byte(b, data) {
    if (!data) {
      this.cmd = b; this.args = []; this.half = -1;
      if (b === 0x2c) { this.x = this.xs; this.y = this.ys; } else if (b === 0x11) this.sleep = false; else if (b === 0x10) this.sleep = true;
      else if (b === 0x29) this.on = true; else if (b === 0x28) this.on = false; else if (b === 0x21) this.invert = true; else if (b === 0x20) this.invert = false; else if (b === 0x01) this.reset();
      this.version++; return;
    }
    if (this.cmd === 0x2c || this.cmd === 0x3c) { if (this.half < 0) { this.half = b; return; } this.put((this.half << 8) | b); this.half = -1; return; }
    const a = this.args; a.push(b);
    if (this.cmd === 0x2a && a.length === 4) { this.xs = (a[0] << 8) | a[1]; this.xe = (a[2] << 8) | a[3]; this.x = this.xs; }
    else if (this.cmd === 0x2b && a.length === 4) { this.ys = (a[0] << 8) | a[1]; this.ye = (a[2] << 8) | a[3]; this.y = this.ys; }
    else if (this.cmd === 0x36 && a.length === 1) this.madctl = b;
  }
  // Endereço da memória → ponto na tela, pela orientação do MADCTL (rotação 0 das bibliotecas = MX ligado).
  put(px) {
    const m = this.madctl, mv = m & 0x20, mx = !(m & 0x40), my = m & 0x80;
    let col = this.x, row = this.y; if (mv) [col, row] = [row, col]; if (mx) col = this.width - 1 - col; if (my) row = this.height - 1 - row;
    if (col >= 0 && row >= 0 && col < this.width && row < this.height) { this.fb[row * this.width + col] = px; this.pixels++; this.version++; }
    if (++this.x > this.xe) { this.x = this.xs; if (++this.y > this.ye) this.y = this.ys; }
  }
  // O vidro do GC9A01 é invertido de fábrica: sem INVON (0x21) as cores saem negativas; as bibliotecas sempre mandam INVON.
  rgb(x, y) { const v = this.fb[y * this.width + x], r = ((v >> 11) & 31) * 255 / 31, g = ((v >> 5) & 63) * 255 / 63, b = (v & 31) * 255 / 31, k = this.invert ? 0 : 255; return [Math.round(Math.abs(k - r)), Math.round(Math.abs(k - g)), Math.round(Math.abs(k - b))]; }
  // Quadro RGBA para um canvas (preto se a tela está desligada ou dormindo).
  rgba(out = new Uint8ClampedArray(this.width * this.height * 4)) {
    const lit = this.on && !this.sleep;
    for (let i = 0, n = this.width * this.height; i < n; i++) { const v = lit ? this.fb[i] : 0; let r = ((v >> 11) & 31) << 3, g = ((v >> 5) & 63) << 2, b = (v & 31) << 3; if (lit && !this.invert) { r = 255 - r; g = 255 - g; b = 255 - b; } out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255; }
    return out;
  }
}

// MAX30102 (Analog Devices, 0x57): oxímetro de pulso com LED vermelho e infravermelho e FIFO de 32 amostras.
// O sinal é sintético mas com a forma de um PPG (pico sistólico + nó dicrótico) no ritmo e na saturação escolhidos:
// AC/DC de 0,6 % no infravermelho (dedo, faixa típica 0,5–2 %); R = (AC/DC vermelho)/(AC/DC infravermelho) segue
// SpO2 ≈ 110 − 25·R, a aproximação usada nas notas de aplicação. Testado com o checkForBeat da SparkFun de 50 a 150 bpm.
export class Max30102 extends RegisterDevice {
  // rhythm: 'sinus' (variabilidade normal, ~3 % entre batimentos) ou 'af' (fibrilação atrial: intervalos irregularmente
  // irregulares, ±35 % sorteados batimento a batimento). motion: 0–1, artefato de movimento do pulso (o ruído de campo
  // que modelos como o Pulse-PPG aprendem a tolerar): componente lenta + saltos, centenas de vezes o sinal cardíaco.
  constructor({ address = 0x57, bpm = 72, spo2 = 98, finger = true, rhythm = 'sinus', motion = 0, seed = 1 } = {}) { super(address); Object.assign(this, { bpm, spo2, finger, rhythm, motion }); this.rng = seed >>> 0 || 1; this.boot(); }
  boot() { this.reg.fill(0); this.reg[0xff] = 0x15; this.reg[0xfe] = 0x03; this.reg[0x00] = 0x01; this.fifo = []; this.wr = 0; this.rd = 0; this.ovf = 0; this.t0 = null; this.byteIdx = 0; this.made = 0; }
  rand() { this.rng ^= this.rng << 13; this.rng >>>= 0; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5; this.rng >>>= 0; return this.rng / 4294967296; }
  get rate() { const sr = [50, 100, 200, 400, 800, 1000, 1600, 3200][(this.reg[0x0a] >> 2) & 7], avg = 1 << Math.min(5, (this.reg[0x08] >> 5) & 7); return sr / avg; }
  get leds() { const m = this.reg[0x09] & 7; return m === 2 ? 1 : m === 3 ? 2 : m === 7 ? [this.reg[0x11] & 7, (this.reg[0x11] >> 4) & 7, this.reg[0x12] & 7, (this.reg[0x12] >> 4) & 7].filter(Boolean).length : 0; }
  nextInterval() { const base = 60 / this.bpm; if (this.rhythm === 'af') return base * (0.65 + 0.7 * this.rand()); const g = (this.rand() + this.rand() + this.rand() - 1.5) * 2; return base * (1 + 0.03 * g); }
  ppg(t, red) {
    if (!this.finger) return 900 + Math.round(200 * this.rand());
    // Fase integrada amostra a amostra; cada batimento sorteia a duração do próximo (ritmo e variabilidade).
    if (this.lastT === undefined || t < this.lastT) { this.lastT = t; this.phase = 0; this.beatLen = this.nextInterval(); this.beats = 0; }
    else if (t > this.lastT) { this.phase += (t - this.lastT) / this.beatLen; this.lastT = t; while (this.phase >= 1) { this.phase -= 1; this.beatLen = this.nextInterval(); this.beats++; } }
    const phase = this.phase, shape = Math.exp(-(((phase - 0.15) / 0.06) ** 2)) + 0.2 * Math.exp(-(((phase - 0.42) / 0.1) ** 2));
    const R = (110 - this.spo2) / 25, dc = red ? 80000 : 110000, ac = red ? dc * 0.006 * R : dc * 0.006;
    let art = 0;
    if (this.motion > 0) { if (this.artT !== t) { this.artT = t; this.artV = this.motion * (2500 * Math.sin(2 * Math.PI * 1.6 * t) + 1500 * Math.sin(2 * Math.PI * 0.7 * t + 1) + (this.rand() < 0.02 ? 4000 * (this.rand() - 0.5) : 0)); } art = this.artV * (red ? 0.8 : 1); }
    const bits = 15 + (this.reg[0x0a] & 3), v = Math.round(dc - ac * shape + art + (this.rand() - 0.5) * 40);
    return Math.max(0, Math.min(0x3ffff, v)) >> (18 - bits) << (18 - bits);
  }
  produce() {
    const shdn = this.reg[0x09] & 0x80, n = this.leds; if (shdn || !n) { this.t0 = null; return; }
    const now = this.time; if (this.t0 === null) { this.t0 = now; this.made = 0; return; }
    const due = Math.floor((now - this.t0) * this.rate) - this.made;
    for (let k = 0; k < Math.min(due, 64); k++) {
      const t = this.t0 + (this.made + k + 1) / this.rate, sample = [this.ppg(t, true), this.ppg(t, false)].slice(0, n);
      if (this.fifo.length >= 32) { if (this.reg[0x08] & 0x10) this.fifo.shift(); else { this.ovf = Math.min(31, this.ovf + 1); continue; } }
      this.fifo.push(sample); this.wr = (this.wr + 1) & 31;
    }
    this.made += Math.max(0, due); if (this.fifo.length) this.reg[0x00] |= 0x40;
  }
  prepareRead() { this.produce(); this.byteIdx = 0; }
  writeReg(r, v) {
    if (r === 0x09 && (v & 0x40)) { this.boot(); return; }
    if (r === 0x04) { this.wr = v & 31; return; } if (r === 0x06) { this.rd = v & 31; this.fifo.length = 0; return; } if (r === 0x05) { this.ovf = v & 31; return; }
    if (r === 0x21 && (v & 1)) { this.reg[0x1f] = 31; this.reg[0x20] = 4; this.reg[0x01] |= 0x02; return; }
    this.reg[r] = v; if (r === 0x09 || r === 0x0a || r === 0x08) { this.t0 = null; }
  }
  read() {
    if (this.ptr !== 0x07) return super.read();
    // FIFO_DATA não avança o ponteiro de registrador: 3 bytes por LED, depois a próxima amostra.
    const s = this.fifo[0], n = this.leds || 1, li = Math.floor(this.byteIdx / 3) % n, part = this.byteIdx % 3, v = s ? s[li] ?? 0 : 0;
    if (++this.byteIdx >= 3 * n) { this.byteIdx = 0; if (s) { this.fifo.shift(); this.rd = (this.rd + 1) & 31; } }
    return part === 0 ? (v >> 16) & 3 : part === 1 ? (v >> 8) & 0xff : v & 0xff;
  }
  readReg(r) {
    if (r === 0x00) { this.produce(); const v = this.reg[0x00]; this.reg[0x00] = 0; return v; }
    if (r === 0x01) { const v = this.reg[0x01]; this.reg[0x01] = 0; return v; }
    if (r === 0x04) { this.produce(); return this.wr; } if (r === 0x05) return this.ovf; if (r === 0x06) return this.rd;
    return this.reg[r];
  }
}

// TMP117 (Texas Instruments, 0x48–0x4B): termômetro de ±0,1 °C. Registradores de 16 bits em big-endian; o ponteiro não
// avança na leitura (lê-se MSB e LSB do mesmo registrador). 0x00 temperatura (7,8125 m°C/LSB), 0x01 configuração
// (bit 13 = dado pronto), 0x02/0x03 limites, 0x0F identificação 0x0117.
export class Tmp117 {
  constructor({ address = 0x48, temperature = 36.6 } = {}) { this.address = address; this.temperature = temperature; this.ptr = 0; this.regs = { 0x01: 0x0220, 0x02: 0x6000, 0x03: 0x8000, 0x0f: 0x0117 }; this.out = []; this.first = true; this.version = 0; }
  start(read) { if (read) { const v = this.ptr === 0 ? Math.round(this.temperature / 0.0078125) & 0xffff : this.ptr === 0x01 ? this.regs[1] | 0x2000 : this.regs[this.ptr] ?? 0; this.out = [v >> 8 & 0xff, v & 0xff]; } else { this.first = true; this.buf = []; } return true; }
  write(b) { if (this.first) { this.ptr = b; this.first = false; return true; } this.buf.push(b); if (this.buf.length === 2 && this.ptr !== 0 && this.ptr !== 0x0f) { this.regs[this.ptr] = (this.buf[0] << 8) | this.buf[1]; this.version++; } return true; }
  read() { return this.out.shift() ?? 0; }
  stop() {}
}
