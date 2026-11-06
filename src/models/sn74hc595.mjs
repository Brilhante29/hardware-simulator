// TI SCLS041J, sections 8.1 and 8.4. Ideal digital model; no timing solver.
export class SN74HC595 {
  constructor() {
    this.shift = 0; this.known = 0;
    this.storage = 0; this.storageKnown = 0;
    this.pins = { SER: 0, SRCLK: 0, RCLK: 0, SRCLR: 1, OE: 1 };
  }
  // Each call is one simultaneous pin event. Unspecified pins retain their level.
  drive(changes) {
    for (const key in changes) {
      if (!Object.hasOwn(this.pins, key) || (changes[key] !== 0 && changes[key] !== 1))
        throw new TypeError('Expected named input pin with level 0 or 1');
    }
    const shiftRise = this.pins.SRCLK === 0 && changes.SRCLK === 1;
    const latchRise = this.pins.RCLK === 0 && changes.RCLK === 1;
    Object.assign(this.pins, changes);
    // Common clocks capture the OLD shift register (datasheet section 8.1).
    if (latchRise) {
      this.storage = this.pins.SRCLR ? this.shift : 0;
      this.storageKnown = this.pins.SRCLR ? this.known : 255;
    }
    if (!this.pins.SRCLR) { this.shift = 0; this.known = 255; }
    else if (shiftRise) {
      this.shift = ((this.shift << 1) | this.pins.SER) & 255;
      this.known = ((this.known << 1) | 1) & 255;
    }
  }
  output(bit) {
    if (!Number.isInteger(bit) || bit < 0 || bit > 7) throw new RangeError('Output bit 0..7');
    return this.pins.OE ? 'Z' : (this.storageKnown & (1 << bit)) ? (this.storage >> bit) & 1 : 'X';
  }
  get serial() { return this.known & 128 ? (this.shift >> 7) & 1 : 'X'; }
}
