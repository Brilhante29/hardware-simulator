// Firmware real (compilado pelo PlatformIO) rodando no emulador: ATmega328P (Uno) e ATmega2560 (Mega 2560).
import { readFileSync } from 'node:fs';
import { ATmega328P, ATmega2560, createMcu, detectChip, parseHex } from '../src/emulator/avr.mjs';
import { LcdI2C, LcdParallel, Ssd1306, Bme280, Mpu6050, Ds3231, Bh1750, Dht } from '../src/emulator/devices.mjs';
// Bordas de pinos (em ciclos) e UART 8N1 por bit: para bibliotecas que fazem serial em software.
const edgeLog = (m, pins) => { const log = Object.fromEntries(pins.map(p => [p, []])), prev = m.onPinChange; m.onPinChange = (c, t, all) => { for (const p of pins) if (c[p]) log[p].push([m.cycles, c[p].level]); prev?.(c, t, all); }; return log; };
const levelAt = (edges, c, idle = 1) => { let v = idle; for (const [t, l] of edges) { if (t > c) break; v = l; } return v; };
const decodeUart = (edges, baud) => { const bit = 16e6 / baud; let out = '', next = 0; for (const [f, l] of edges) { if (l || f < next) continue; let b = 0; for (let k = 0; k < 8; k++) b |= levelAt(edges, f + (1.5 + k) * bit) << k; out += String.fromCharCode(b); next = f + 9.5 * bit; } return out; };
const sendUart = (m, pin, text, baud, at, gap = 0.003) => { const bit = 16e6 / baud; let t = at; m.setInput(pin, 1); for (const ch of text) { const b = ch.charCodeAt(0); [0, ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => (b >> k) & 1), 1].forEach((l, k) => m.schedule(Math.round(t + k * bit), () => m.setInput(pin, l))); t += gap * 16e6; } };
// Segunda passada: os firmwares do Uno recompilados para o Mega (fixtures/avr/mega), com os pinos que mudam de lugar.
let onMega = false; const pin = n => onMega ? ({ D8: 'PD4', D10: 'D53', D6: 'PE2', D7: 'D5' }[n] ?? n) : n;
const hex = n => readFileSync(new URL(`./fixtures/avr/${onMega && !n.startsWith('mega_') ? 'mega/' : ''}${n}.hex`, import.meta.url), 'utf8');
function boot(name) { const m = onMega ? createMcu(hex(name)) : new ATmega328P(hex(name)); m.out = ''; m.onSerial = b => { m.out += String.fromCharCode(b); }; return m; }
// Mega: saída de cada USART em outs[0..3].
function mega(name) { const m = createMcu(hex(name)); m.outs = ['', '', '', '']; m.onSerial = (b, i) => { m.outs[i] += String.fromCharCode(b); }; return m; }

export function runAvrTests({ mega: megaPass = false } = {}) {
  onMega = megaPass;
  const results = []; const test = (name, source, fn) => { if (megaPass && /^(Mega|Velocidade)/.test(name)) return; name = megaPass ? `[Mega] ${name}` : name; try { fn(); results.push({ name, source, pass: true }); } catch (e) { results.push({ name, source, pass: false, error: e.message }); } };
  const ok = (x, msg = 'Condição não atendida') => { if (!x) throw Error(msg); };
  const eq = (a, b) => { if (a !== b) throw Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

  test('Intel HEX: checksum e tamanho do blink', 'Intel HEX', () => { eq(parseHex(hex('blink')).size, onMega ? 2872 : 2154); let bad = false; try { parseHex(':0100000000FE'); } catch { bad = true; } ok(bad, 'checksum errado aceito'); });
  test('Blink: D13 alterna a cada 500 ms (±1 ms)', 'delay() via Timer0', () => {
    const m = boot('blink'), edges = []; m.onPinChange = (c, t) => { if (c.D13 && c.D13.mode === 'output') edges.push([t, c.D13.level]); };
    m.runSeconds(2.2); const highs = edges.filter(e => e[1] === 1).map(e => e[0]);
    ok(highs.length >= 3); for (let i = 1; i < highs.length; i++) ok(Math.abs(highs[i] - highs[i - 1] - 1) < 0.002, `período ${highs[i] - highs[i - 1]}`);
  });
  test('Blink: Serial e millis() batem com o tempo simulado', 'USART0 + Timer0', () => { const m = boot('blink'); m.runSeconds(2.1); eq(m.out, 'boot ok\r\n999\r\n1999\r\n'); });
  test('Matemática de 32 bits, float, CRC32 e String', 'Núcleo AVR (avr-gcc)', () => { const m = boot('math'); m.runSeconds(0.5); eq(m.out, '-1250\r\n539\r\n370370367\r\n1.414214\r\n0.50000\r\n3141.59\r\n217C885F\r\n40320\r\nUno328P\r\n-4\r\n249\r\n142857\r\nfim\r\n'); });
  test('analogWrite: PWM de 25 %, 75 % e 50 % em D9, D5 e D11', 'Timer0/1/2 COM e OCR', () => { const m = boot('pwm'); m.runSeconds(0.1); const p = m.pinSnapshot(); eq(p.D9.duty, 0.25); eq(p.D5.duty, onMega ? 191 / 256 : 0.75); /* no Mega o D5 é do Timer3 (fase correta) */ eq(p.D11.duty, 0.5); });
  test('digitalRead com INPUT_PULLUP: botão no GND acende D13', 'GPIO PIND', () => {
    const m = boot('button'); m.runSeconds(0.05); eq(m.pinSnapshot().D13.level, 0);
    m.setInput('D2', 0); m.runSeconds(0.05); eq(m.pinSnapshot().D13.level, 1);
    m.setInput('D2', null); m.runSeconds(0.05); eq(m.pinSnapshot().D13.level, 0); eq(m.out, 'btn=1\r\nbtn=0\r\nbtn=1\r\n');
  });
  test('analogRead: 2,5 V → 512; 5 V → 1023; 0 V → 0', 'ADC 10 bits', () => { const m = boot('adc'); m.analog[0] = 2.5; m.runSeconds(0.15); m.analog[0] = 5; m.runSeconds(0.1); m.analog[0] = 0; m.runSeconds(0.1); eq(m.out, '512\r\n512\r\n1023\r\n0\r\n'); });
  test('Serial RX: o Uno recebe e devolve em maiúsculas', 'USART0 RX + interrupção', () => { const m = boot('echo'); m.runSeconds(0.05); m.serialInput('ola, uno!\n'); m.runSeconds(0.1); eq(m.out, 'pronto\r\nOLA, UNO!\n'); });
  test('attachInterrupt (INT0) conta 3 bordas; PCINT0 conta 2 mudanças', 'EICRA/EIMSK e PCICR/PCMSK0', () => {
    const m = boot('interrupts'); m.runSeconds(0.05);
    for (let i = 0; i < 3; i++) { m.setInput('D2', 0); m.runSeconds(0.01); m.setInput('D2', null); m.runSeconds(0.01); }
    if (onMega) { m.setInput('D53', 1); m.runSeconds(0.01); m.setInput('D53', 0); m.runSeconds(0.01); m.setInput('D53', 1); m.runSeconds(0.2); ok(m.out.trim().endsWith('3,3'), m.out); return; } // PB0 = D53, sem pull-up no sketch
    m.setInput('D8', 0); m.runSeconds(0.01); m.setInput('D8', null); m.runSeconds(0.2); ok(m.out.trim().endsWith('3,2'), m.out);
  });
  test('EEPROM.put/get e update sobrevivem ao reset', 'EECR/EEDR/EEAR', () => { const m = boot('eeprom'); m.runSeconds(0.2); eq(m.out, '1 1.50 uno 42\r\n'); m.out = ''; m.reset(); m.runSeconds(0.2); eq(m.out, '2 1.50 uno 42\r\n'); });
  test('Watchdog reinicia o chip e acorda do power-down', 'WDTCSR, MCUSR e SLEEP', () => { const m = boot('watchdog'); let resets = 0; m.onReset = () => resets++; m.runSeconds(0.5); eq(m.out, 'boot normal\r\nreset pelo watchdog\r\nacordou 5\r\n'); eq(resets, 1); });
  test('SPI mestre troca bytes com o dispositivo', 'SPCR/SPSR/SPDR', () => { const m = boot('spi'); m.spiDevice = b => b ^ 0xff; m.runSeconds(0.05); eq(m.out, '5A C3\r\n'); });
  test('Servo.write(90) gera 1.472 µs a 50 Hz; tone(440) gera 440 Hz', 'Timer1/Timer2 + ISR', () => {
    const m = boot('servo'); m.runSeconds(0.3); const s = m.pulseInfo('D9'), t = m.pulseInfo('D8');
    ok(Math.abs(s.highUs - 1472) < 8 && Math.abs(s.periodUs - 20000) < 50, JSON.stringify(s)); ok(Math.abs(t.hz - 440) < 2, JSON.stringify(t));
  });
  test('Scanner I²C encontra o LCD (0x27) e o OLED (0x3C)', 'TWI mestre (Wire)', () => { const m = boot('scan'); m.attachI2C(0x27, new LcdI2C()); m.attachI2C(0x3c, new Ssd1306()); m.runSeconds(0.3); eq(m.out, '0x27\r\n0x3C\r\nfim\r\n'); });
  test('LiquidCrystal_I2C escreve nas duas linhas do LCD', 'PCF8574 + HD44780 4 bits', () => { const m = boot('lcd'); const lcd = m.attachI2C(0x27, new LcdI2C()); m.runSeconds(1.2); eq(lcd.lines()[0], 'Hardware Studio '); ok(lcd.lines()[1].startsWith('Uno no I2C :) ')); ok(lcd.backlight); });
  test('Adafruit SSD1306 desenha texto, retângulo e círculo', 'SSD1306 endereçamento horizontal', () => {
    const m = boot('oled'); const o = m.attachI2C(0x3c, new Ssd1306()); m.runSeconds(1); eq(m.out, 'oled ok\r\n'); ok(o.on);
    ok(o.pixel(0, 40) && o.pixel(127, 40) && o.pixel(0, 63), 'retângulo'); ok(o.pixel(64, 52), 'círculo'); ok(!o.pixel(64, 30), 'fundo');
  });
  test('BME280 (Adafruit): 23,4 °C, 1007,5 hPa e 61,2 % pelas fórmulas da Bosch', 'BME280 datasheet §4.2.3', () => {
    const m = boot('bme280'); const b = m.attachI2C(0x76, new Bme280({ temperature: 23.4, pressure: 1007.5, humidity: 61.2 })); m.runSeconds(0.3); b.temperature = 31; m.runSeconds(0.6);
    const lines = m.out.trim().split('\r\n'); eq(lines[0], '23.40 1007.50 61.21'); ok(lines.at(-1).startsWith('31.00 '), lines.at(-1));
  });
  test('MPU6050 (Adafruit): 0,5 g → 4,90 m/s² e 45 °/s → 0,786 rad/s', 'MPU-6000 registradores 0x3B–0x48', () => { const m = boot('mpu6050'); m.attachI2C(0x68, new Mpu6050({ accel: [0.5, -0.25, 1], gyro: [0, 0, 45], temperature: 28 })); m.runSeconds(0.5); eq(m.out.split('\r\n')[0], '4.90 -2.45 9.81 0.786 28.0'); });
  test('DS3231 (RTClib): ajuste, segundos correndo e virada do dia', 'DS3231 registradores BCD', () => { const m = boot('ds3231'); m.attachI2C(0x68, new Ds3231()); m.runSeconds(3.2); ok(m.out.startsWith('ajustado\r\n2026-11-07 23:59:58 25.00'), m.out); ok(m.out.includes('2026-11-08 00:00:00'), m.out); });
  test('BH1750: 432,5 lux', 'BH1750FVI modo H-res', () => { const m = boot('bh1750'); m.attachI2C(0x23, new Bh1750({ lux: 432.5 })); m.runSeconds(0.5); eq(m.out.split('\r\n')[0], '432.5'); });
  test('Adafruit NeoPixel: cores WS2812 decodificadas dos pulsos em D6', 'WS2812B: 0,4/0,8 µs, reset > 50 µs', () => {
    const m = boot('neopixel'); m.runSeconds(0.05); eq(JSON.stringify(m.neopixel('D6')), '[[255,0,0],[0,255,0],[0,0,255],[18,52,86],[0,0,0],[0,0,0],[0,0,0],[255,255,255]]');
    m.runSeconds(0.2); eq(JSON.stringify(m.neopixel('D6')[7]), '[210,100,45]');
  });
  test('DHT22 (Adafruit): −3,7 °C e 48,3 % pelo protocolo de um fio', 'AM2302: pulsos de 26/70 µs', () => { const m = boot('dht22'); const d = m.attachPinDevice('D4', new Dht({ type: 22, temperature: -3.7, humidity: 48.3 })); m.runSeconds(2.3); eq(m.out, '-3.7 48.3\r\n'); d.temperature = 31.2; m.runSeconds(2.2); ok(m.out.endsWith('31.2 48.3\r\n'), m.out); });
  test('DHT11 (Adafruit): 26 °C e 61 %', 'DHT11: start de 18 ms', () => { const m = boot('dht11'); m.attachPinDevice('D4', new Dht({ type: 11, temperature: 26, humidity: 61 })); m.runSeconds(2.3); eq(m.out, '26.0 61.0\r\n'); });
  test('Comparador analógico: ACO e interrupção a cada cruzamento', 'ACSR, AIN0/AIN1', () => { const m = boot('comparator'); m.setAnalogPin(pin('D6'), 2.5); m.setAnalogPin(pin('D7'), 1); m.runSeconds(0.15); m.setAnalogPin(pin('D7'), 3); m.runSeconds(0.1); m.setAnalogPin(pin('D7'), 1); m.runSeconds(0.1); eq(m.out, '1,0\r\n0,1\r\n1,2\r\n'); });
  test('Captura de entrada do Timer1 mede 1 kHz como 1000 µs', 'ICP1/ICR1/ICF1', () => { const m = boot('capture'); const half = 8000; let lvl = 0; const tick = () => { lvl ^= 1; m.setInput(pin('D8'), lvl); m.schedule(m.cycles + half, tick); }; m.schedule(half, tick); m.runSeconds(0.12); eq(m.out.trim().split('\r\n').at(-1), '1000 us'); });
  test('Serial entre dois Unos: A envia, B recebe e responde', 'USART TX → RX', () => { const a = boot('uartlink'), b = boot('echo'); a.onSerial = x => b.serialByte(x); for (let i = 0; i < 10; i++) { a.runSeconds(0.05); b.runSeconds(0.05); } eq(b.out, 'pronto\r\nPING 0\r\nPING 1\r\nPING 2\r\n'); });
  test('analogReference(INTERNAL): 0,55 V lê 512 na referência de 1,1 V', 'ADMUX REFS', () => { const m = boot('aref'); m.analog[0] = 0.55; m.runSeconds(0.1); eq(m.out, '512\r\n113\r\n'); });
  test('Consumo: ~10,4 mA ativo e cai para µA no power-down', 'DS40002061 Tabela 32-4', () => {
    const a = boot('blink'); a.runSeconds(0.5); ok(Math.abs(a.powerUsage().averageMa - (onMega ? 20 : 10.4)) < 0.01);
    const w = boot('watchdog'); w.runSeconds(0.5); const e = w.energy; ok(e.deep > 0, 'sem sleep'); ok(w.powerUsage().averageMa < (onMega ? 20 : 10.4));
  });
  test('I²C entre dois Unos: Wire mestre ↔ Wire escravo (onReceive/onRequest)', 'TWI escravo com clock stretching', () => {
    const M = boot('i2cmaster'), S = boot('i2cslave'); M.linkI2C(S); for (let t = 0; t < 0.25; t += 0.0001) { M.runSeconds(0.0001); S.runSeconds(0.0001); }
    eq(S.out, 'x is 0\r\nx is 1\r\nx is 2\r\n'); ok(M.out.startsWith('tx=0 rx=hello \r\ntx=0 rx=hello '), M.out);
  });
  test('SPI entre dois Unos: escravo responde pela ISR com SS no D10', 'SPI escravo (SPCR sem MSTR)', () => {
    const M = boot('spimaster'), S = boot('spislave'); M.linkSPI(S, pin('D10')); for (let t = 0; t < 0.25; t += 0.00001) { M.runSeconds(0.00001); S.runSeconds(0.00001); }
    ok(M.out.startsWith('A0 12 23\r\n1 12 23'), M.out); ok(S.out.includes('bytes=6'), S.out);
  });
  test('USART0 como SPI mestre (MSPIM) troca 2 bytes', 'UCSR0C UMSEL = 11', () => { const m = boot('mspim'); m.mspimDevice = b => b ^ 0xff; m.runSeconds(0.05); eq(m.out, 'A5 3C\r\n'); });
  // Bibliotecas que fazem tempo por laço de ciclos, bit-banging ou ISR de pino (rodam no Uno e, na segunda passada, no Mega).
  test('SoftwareSerial 9600: transmite e recebe por bit-banging com PCINT', 'SoftwareSerial (RX D10, TX D11)', () => {
    const m = boot('lib_softserial'), log = edgeLog(m, ['D11']); m.runSeconds(0.1); sendUart(m, 'D10', 'abc', 9600, m.cycles + 1000); m.runSeconds(0.1);
    eq(decodeUart(log.D11, 9600), 'soft ola\r\nABC'); eq(m.out, 'pronto\r\nabc');
  });
  test('pulseIn mede 1.500/700 µs (lendo até 10 µs a menos, como no chip real: o ISR do millis pausa o laço); shiftOut/shiftIn', 'wiring_pulse.S, shiftOut/shiftIn', () => {
    const m = boot('lib_pulsein'), log = edgeLog(m, ['D5', 'D4']); let lv = 0; const tick = () => { lv ^= 1; m.setInput('D7', lv); m.schedule(m.cycles + (lv ? 1500 : 700) * 16, tick); }; m.schedule(2000, tick);
    let clk = 0; const prev = m.onPinChange; m.onPinChange = (c, t, a) => { prev(c, t, a); if (c.D5?.level === 1) { if (clk >= 16) m.setInput('D6', (0x5a >> (7 - (clk - 16))) & 1); clk++; } };
    m.runSeconds(0.1); const lines = m.out.split('\r\n'), [hi, lo] = lines[0].split(' ').map(Number);
    ok(hi >= 1490 && hi <= 1500 && lo >= 690 && lo <= 700, lines[0]); eq(log.D5.filter(e => e[1]).slice(0, 16).map(e => levelAt(log.D4, e[0], 0)).join(''), '1010010100111100'); eq(lines[1], '5A'); ok(+lines[2] >= 1000 && +lines[2] <= 1060, lines[2]);
  });
  test('tone(8, 1000, 200) para sozinho; tone(9, 2500) mede 2.500 Hz na média', 'Timer2 + ISR que alterna o pino', () => {
    const m = boot('lib_tone'); m.runSeconds(0.1); const a = m.pulseInfo('D8'); m.runSeconds(0.6); const b = m.pulseInfo('D8'), c = m.pulseInfo('D9');
    ok(Math.abs(a.hz - 1000) < 0.5, a.hz); eq(b, null); ok(Math.abs(c.hz - 2500) < 0.5, c.hz); m.runSeconds(0.5); eq(m.out, 'fim\r\n'); eq(m.levelOf('D9'), 0);
  });
  test('LiquidCrystal paralelo (RS 12, EN 11, D4–D7 em 5..2) com caractere criado', 'HD44780 em 4 bits pelos pinos', () => {
    const m = boot('lib_lcdpar'), lcd = m.attachPinDevice('D11', new LcdParallel()); m.runSeconds(1.3); const l = lcd.lines();
    eq(l[0], 'LiquidCrystal   '); ok(l[1].startsWith('t=') && l[1].slice(3, 6) === ' 1 ', l[1]); eq(lcd.ddram[0x42], 0); eq(lcd.glyphs()['1,2'].join(), '0,10,31,31,14,4,0,0'); // o coração criado aparece na tela
  });
  test('FastLED: 4 LEDs WS2812B no D6 com as cores exatas', 'clockless em assembly (ciclos contados)', () => { const m = boot('lib_fastled'); m.runSeconds(0.05); eq(JSON.stringify(m.neopixel('D6')), '[[255,0,0],[0,255,0],[0,0,255],[18,52,86]]'); });
  test('12 servos ao mesmo tempo (D2..D13), 0° a 165°', 'Servo com vários canais por timer', () => {
    const m = boot('lib_servos'); m.runSeconds(0.2); for (let i = 0; i < 12; i++) { const w = m.pulseInfo('D' + (2 + i))?.highUs, want = 544 + i * 15 * (2400 - 544) / 180; ok(w && Math.abs(w - want) < 8, `D${2 + i}: ${w} ≠ ${want}`); }
  });
  test('TimerOne: ISR a cada 1 ms e PWM de 25 % no OC1A', 'TimerOne (Timer1 modo 8, ICR1)', () => { const m = boot('lib_timerone'); m.runSeconds(0.6); ok(Math.abs(+m.out.trim() - 500) <= 3, m.out); ok(Math.abs(m.pinSnapshot()[onMega ? 'D11' : 'D9'].duty - 0.25) < 0.01); });
  test('Stepper: 10 passos e 3 de volta terminam na fase 3 (bobinas 1001)', 'Stepper 4 fios', () => { const m = boot('lib_stepper'); m.runSeconds(0.2); eq(m.out, 'ok\r\n'); const s = m.pinSnapshot(); eq(['D8', 'D9', 'D10', 'D11'].map(p => s[p].level).join(''), '1001'); });
  test('Mega: o .hex diz qual é o chip (tabela de 57 vetores)', 'detectChip', () => {
    eq(detectChip(hex('blink')), 'atmega328p'); eq(detectChip(hex('mega_serial')), 'atmega2560'); ok(mega('mega_serial') instanceof Object && mega('mega_serial').chip.name === 'ATmega2560');
    let refused = false; try { new ATmega328P(hex('mega_big')); } catch (e) { refused = /não cabe/.test(e.message); } ok(refused, '138 KB aceitos num chip de 32 KB');
  });
  test('Mega: Serial, Serial1, Serial2 e Serial3 com baud próprio; Serial1 ecoa', 'USART0..3 (0xC0, 0xC8, 0xD0, 0x130)', () => {
    const m = mega('mega_serial'), edges = []; m.onPinChange = (c, t) => { if (c.D13) edges.push([t, c.D13.level]); };
    m.runSeconds(0.1); m.serialInput('ola mega', 1); m.runSeconds(1.2);
    eq(m.outs[0], 'mega0\r\nRAM livre ok: 21FF\r\nOLA MEGA'); eq(m.outs[1], 'um\r\n'); eq(m.outs[2], 'dois\r\n'); eq(m.outs[3], 'tres\r\n');
    const highs = edges.filter(e => e[1]).map(e => e[0]); ok(highs.length && Math.abs(highs[0] - 0.5) < 0.002, `D13 (PB7) em ${highs[0]}`);
  });
  test('Mega: analogWrite nos 15 pinos PWM (Timers 0 a 5, canais A/B/C)', 'OCRnA/B/C, COMnx', () => {
    const m = mega('mega_pwm'); m.runSeconds(0.05); const p = m.pinSnapshot(), pins = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46];
    pins.forEach((n, i) => { const v = 16 * (i + 1), want = n === 4 || n === 13 ? (v + 1) / 256 : v / 256; ok(Math.abs(p['D' + n].duty - want) < 1e-9, `D${n}: ${p['D' + n].duty} ≠ ${want}`); });
  });
  test('Mega: INT0, INT3, INT4, INT5 e PCINT2 (porta K)', 'EICRA/EICRB, PCMSK2', () => {
    const m = mega('mega_irq'); m.runSeconds(0.05); const tog = (pin, n) => { for (let i = 0; i < n; i++) { m.setInput(pin, 0); m.runSeconds(0.002); m.setInput(pin, null); m.runSeconds(0.002); } };
    tog('D2', 3); tog('D3', 2); tog('D18', 2); tog('D21', 1); tog('A8', 2); m.runSeconds(0.2); ok(m.outs[0].endsWith('3 2 4 1 4\r\n'), m.outs[0].slice(-40));
  });
  test('Mega: ADC8/ADC15 (MUX5), referência de 2,56 V, EEPROM de 4 KB e Servo no Timer5', 'ADCSRB MUX5, REFS = 11', () => {
    const m = mega('mega_adc'); m.analog[0] = 1.28; m.analog[8] = 2.5; m.analog[15] = 5; m.runSeconds(0.3);
    eq(m.outs[0], '262\r\n512\r\n1023\r\n512\r\n1023\r\n4096\r\n0\r\n'); eq(m.eeprom[4095], 0); const s = m.pulseInfo('D9'); ok(s && Math.abs(s.highUs - 1010) < 3 && Math.abs(s.periodUs - 20000) < 20, JSON.stringify(s));
  });
  test('Mega: 138 KB de flash — ELPM com RAMPZ, código acima de 128 KB e ponteiro de função', 'PC de 17 bits, EICALL, .data', () => {
    const m = mega('mega_big'); m.runSeconds(0.6); eq(m.outs[0], 'dados na RAM\r\n4003243\r\n4004640\r\n4088928\r\n4081878\r\n1019200\r\ntab4 em 0x108\r\n'); eq(m.lastError, null);
  });
  test('Mega: D13 também sai pelo OC1C (Timer1 canal C, fast PWM de 10 bits)', 'PB7 = OC0A/OC1C', () => { const m = mega('mega_oc1c'); m.runSeconds(0.05); eq(m.pinSnapshot().D13.duty, 0.25); });
  test('Mega: LCD I²C em D20/D21', 'TWI do 2560', () => { const m = mega('mega_lcd'), lcd = m.attachI2C(0x27, new LcdI2C()); m.runSeconds(1.5); eq(lcd.lines()[0], 'Mega 2560       '); eq(lcd.lines()[1], '256 KB flash    '); });
  test('Mega: consumo do 2560 (~20 mA ativo a 16 MHz) e pelo menos 1× o tempo real', 'Atmel 2549Q §31.1', () => {
    const m = mega('mega_serial'); const t = performance.now(); m.runSeconds(1); const ms = performance.now() - t; ok(ms < 1000, `${ms.toFixed(0)} ms para 1 s`); ok(Math.abs(m.powerUsage().averageMa - 20) < 0.01);
  });
  test('Velocidade: pelo menos 1× o tempo real', 'Desempenho', () => { const m = boot('blink'); const t = performance.now(); m.runSeconds(1); const ms = performance.now() - t; ok(ms < 1000, `${ms.toFixed(0)} ms para 1 s`); });
  return results;
}
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { const r = [...runAvrTests(), ...runAvrTests({ mega: true })]; for (const x of r) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${r.filter(x => x.pass).length}/${r.length} testes do emulador passaram`); if (r.some(x => !x.pass)) process.exitCode = 1; }
