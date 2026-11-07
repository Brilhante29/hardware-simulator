// Firmware real (compilado pelo PlatformIO) rodando no emulador ATmega328P.
import { readFileSync } from 'node:fs';
import { ATmega328P, parseHex } from '../src/emulator/avr.mjs';
import { LcdI2C, Ssd1306 } from '../src/emulator/devices.mjs';
const hex = n => readFileSync(new URL(`./fixtures/avr/${n}.hex`, import.meta.url), 'utf8');
function boot(name) { const m = new ATmega328P(hex(name)); m.out = ''; m.onSerial = b => { m.out += String.fromCharCode(b); }; return m; }

export function runAvrTests() {
  const results = []; const test = (name, source, fn) => { try { fn(); results.push({ name, source, pass: true }); } catch (e) { results.push({ name, source, pass: false, error: e.message }); } };
  const ok = (x, msg = 'Condição não atendida') => { if (!x) throw Error(msg); };
  const eq = (a, b) => { if (a !== b) throw Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

  test('Intel HEX: checksum e tamanho do blink', 'Intel HEX', () => { eq(parseHex(hex('blink')).size, 2154); let bad = false; try { parseHex(':0100000000FE'); } catch { bad = true; } ok(bad, 'checksum errado aceito'); });
  test('Blink: D13 alterna a cada 500 ms (±1 ms)', 'delay() via Timer0', () => {
    const m = boot('blink'), edges = []; m.onPinChange = (c, t) => { if (c.D13 && c.D13.mode === 'output') edges.push([t, c.D13.level]); };
    m.runSeconds(2.2); const highs = edges.filter(e => e[1] === 1).map(e => e[0]);
    ok(highs.length >= 3); for (let i = 1; i < highs.length; i++) ok(Math.abs(highs[i] - highs[i - 1] - 1) < 0.002, `período ${highs[i] - highs[i - 1]}`);
  });
  test('Blink: Serial e millis() batem com o tempo simulado', 'USART0 + Timer0', () => { const m = boot('blink'); m.runSeconds(2.1); eq(m.out, 'boot ok\r\n999\r\n1999\r\n'); });
  test('Matemática de 32 bits, float, CRC32 e String', 'Núcleo AVR (avr-gcc)', () => { const m = boot('math'); m.runSeconds(0.5); eq(m.out, '-1250\r\n539\r\n370370367\r\n1.414214\r\n0.50000\r\n3141.59\r\n217C885F\r\n40320\r\nUno328P\r\n-4\r\n249\r\n142857\r\nfim\r\n'); });
  test('analogWrite: PWM de 25 %, 75 % e 50 % em D9, D5 e D11', 'Timer0/1/2 COM e OCR', () => { const m = boot('pwm'); m.runSeconds(0.1); const p = m.pinSnapshot(); eq(p.D9.duty, 0.25); eq(p.D5.duty, 0.75); eq(p.D11.duty, 0.5); });
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
  test('Velocidade: pelo menos 1× o tempo real', 'Desempenho', () => { const m = boot('blink'); const t = performance.now(); m.runSeconds(1); const ms = performance.now() - t; ok(ms < 1000, `${ms.toFixed(0)} ms para 1 s`); });
  return results;
}
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { const r = runAvrTests(); for (const x of r) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${r.filter(x => x.pass).length}/${r.length} testes do emulador passaram`); if (r.some(x => !x.pass)) process.exitCode = 1; }
