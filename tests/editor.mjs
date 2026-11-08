// Testes do interpretador de sketches do editor livre (src/editor/sketch.js).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { parse, timeline } = require('../src/editor/sketch.js');
import { readFileSync } from 'node:fs';
import { MEGA_PINS, UNO_PINS } from '../src/emulator/avr.mjs';
const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
// Pinos [nome, x, y] de uma placa do catálogo do editor.
const catalogPins = type => { const line = appSource.split('\n').find(l => l.includes(`{type:'${type}'`)); return [...line.matchAll(/\['([^']+)',(\d+),(\d+)\]/g)].map(m => [m[1], +m[2], +m[3]]); };

const writes = ops => ops.filter(o => o.t === 'w').map(o => `${o.pin}:${o.level}`);
const delays = ops => ops.filter(o => o.t === 'd').map(o => o.ms);
const cases = [
  ['Blink clássico: setup uma vez, loop com 2 escritas e 2 delays', () => {
    const r = parse('void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}');
    assert.deepEqual(r.setup, []); assert.deepEqual(writes(r.loop), ['13:1', '13:0']); assert.deepEqual(delays(r.loop), [500, 500]); assert.deepEqual(r.warnings, []);
  }],
  ['Constantes, #define e expressões', () => {
    const r = parse('const int led = 9;\n#define ESPERA 200\nvoid loop(){ digitalWrite(led, HIGH); delay(ESPERA); digitalWrite(led, LOW); delay(ESPERA * 2); }');
    assert.deepEqual(writes(r.loop), ['9:1', '9:0']); assert.deepEqual(delays(r.loop), [200, 400]);
  }],
  ['LED_BUILTIN e comentários são entendidos', () => {
    const r = parse('/* bloco */ void loop(){ // linha\n digitalWrite(LED_BUILTIN, HIGH); delay(10); }');
    assert.deepEqual(writes(r.loop), ['13:1']);
  }],
  ['for com contador gera a varredura', () => {
    const r = parse('void loop(){ for (int i = 10; i <= 13; i++) { digitalWrite(i, HIGH); delay(100); digitalWrite(i, LOW); } }');
    assert.deepEqual(writes(r.loop), ['10:1', '10:0', '11:1', '11:0', '12:1', '12:0', '13:1', '13:0']);
  }],
  ['for decrescente e com passo', () => {
    const r = parse('void loop(){ for (int p = 13; p > 9; p -= 2) { digitalWrite(p, HIGH); } delay(1); }');
    assert.deepEqual(writes(r.loop), ['13:1', '11:1']);
  }],
  ['if/else escolhe o ramo certo', () => {
    const r = parse('int modo = 2;\nvoid loop(){ if (modo == 1) { digitalWrite(12, HIGH); } else digitalWrite(11, HIGH); delay(5); }');
    assert.deepEqual(writes(r.loop), ['11:1']);
  }],
  ['setup roda separado do loop', () => {
    const r = parse('void setup(){ digitalWrite(8, HIGH); delay(50); }\nvoid loop(){ digitalWrite(13, HIGH); delay(1); }');
    assert.deepEqual(writes(r.setup), ['8:1']); assert.deepEqual(writes(r.loop), ['13:1']);
  }],
  ['Escritas sem delay são instantâneas e agrupadas no mesmo passo', () => {
    const steps = timeline(parse('void loop(){ digitalWrite(13, HIGH); digitalWrite(12, HIGH); delay(300); digitalWrite(13, LOW); delay(0); }').loop);
    assert.equal(steps.length, 2); assert.equal(steps[0].writes.length, 2); assert.equal(steps[0].ms, 300);
  }],
  ['Chamadas não suportadas viram aviso, sem quebrar', () => {
    const r = parse('void loop(){ Serial.println("oi, (x)"); tone(8, 440); analogWrite(9, 128); while(1){} delay(5); }');
    assert.deepEqual(writes(r.loop), ['9:1']);
    for (const w of ['Serial é ignorado na simulação', 'Ignorado: tone()', 'analogWrite é aproximado: valor > 0 liga, 0 desliga', 'while ainda não é interpretado: bloco ignorado']) assert.ok(r.warnings.includes(w), w);
  }],
  ['Pinos fora de D0–D13 e loop sem delay geram aviso', () => {
    const r = parse('void loop(){ digitalWrite(A0, HIGH); digitalWrite(13, HIGH); digitalWrite(13, LOW); }');
    assert.deepEqual(writes(r.loop), ['13:1', '13:0']); assert.equal(r.loopDelay, 0);
    assert.ok(r.warnings.some(w => w.startsWith('Pino fora')) && r.warnings.some(w => w.startsWith('loop() sem delay')));
  }],
  ['Sketch sem funções continua aceito (trechos soltos)', () => {
    assert.deepEqual(writes(parse('digitalWrite(13, HIGH); delay(300); digitalWrite(13, LOW);').loop), ['13:1', '13:0']);
  }],
  ['Expressões não executam código arbitrário', () => {
    const r = parse('void loop(){ digitalWrite(alert(1), HIGH); delay(globalThis); }');
    assert.deepEqual(r.loop, []); assert.ok(r.warnings.length > 0);
  }],
  ['for gigante é interrompido com aviso', () => {
    const r = parse('void loop(){ for (int i = 0; i < 100000; i++) { delay(1); } }');
    assert.ok(r.warnings.includes('for com repetições demais: interrompido')); assert.ok(r.loop.length <= 2001);
  }],
  ['Catálogo: Uno e Mega expõem todos os pinos de E/S do emulador, em posições únicas', () => {
    for (const [type, map] of [['uno', UNO_PINS], ['mega', MEGA_PINS]]) {
      const pins = catalogPins(type), names = new Set(pins.map(p => p[0]));
      for (const n of Object.keys(map)) assert.ok(names.has(n), `${type} sem ${n}`);
      assert.ok(names.has('5V') && names.has('GND')); assert.equal(new Set(pins.map(p => p[1] + ',' + p[2])).size, pins.length, `${type}: pinos sobrepostos`);
    }
    assert.equal(catalogPins('mega').length, 54 + 16 + 2);
  }],
  ['Mega: pinos de I²C, SPI e seriais do editor batem com as funções do ATmega2560', () => {
    const io = appSource.match(/mega:\{mcu:'atmega2560'.*?serial:(\[\[.*?\]\])/)[0];
    const port = n => MEGA_PINS[n].join(''); // datasheet: SCL=PD0, SDA=PD1, SCK=PB1, MOSI=PB2, SS=PB0, TXD1=PD3, RXD1=PD2, TXD2=PH1, RXD2=PH0, TXD3=PJ1, RXD3=PJ0
    const want = { sda: 'D1', scl: 'D0', sck: 'B1', mosi: 'B2', ss: 'B0' };
    for (const [k, pb] of Object.entries(want)) assert.equal(port(io.match(new RegExp(k + ":'(\\w+)'"))[1]), pb, k);
    const pairs = JSON.parse(io.match(/serial:(\[\[.*?\]\])/)[1].replace(/'/g, '"'));
    assert.deepEqual(pairs.map(([tx, rx]) => port(tx) + '/' + port(rx)), ['E1/E0', 'D3/D2', 'H1/H0', 'J1/J0']);
  }],
];
let passed = 0;
for (const [name, fn] of cases) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } }
console.log(`${passed}/${cases.length} testes do editor passaram`);
