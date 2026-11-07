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
