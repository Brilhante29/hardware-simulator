// Testes do interpretador de sketches do editor livre (src/editor/sketch.js).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { parse, timeline } = require('../src/editor/sketch.js');
const Circuit = require('../src/editor/circuit.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} ± ${tol}`);
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
  ['Solver CC: valores de resistor como as pessoas escrevem', () => {
    for (const [t, v] of [['220 Ω', 220], ['10k', 1e4], ['4,7 kΩ', 4700], ['1M', 1e6], ['1R5', 1.5], ['2k2', 2200], ['abc', 220]]) assert.equal(Circuit.ohms(t), v, t);
  }],
  ['Solver CC: divisor de tensão e LDR (GL5528) no A0', () => {
    const div = Circuit.solve({ sources: [{ node: 'v', volts: 5, r: 0 }, { node: 'g', volts: 0, r: 0 }], resistors: [['v', 'a', 10e3], ['a', 'g', 4.7e3]] });
    near(div.volts('a'), 5 * 4.7 / 14.7, 1e-9);
    const ldr = lux => Circuit.solve({ sources: [{ node: 'v', volts: 5, r: 0 }, { node: 'g', volts: 0, r: 0 }], resistors: [['v', 'a', Circuit.ldrOhms(lux)], ['a', 'g', 10e3]] }).volts('a');
    assert.ok(ldr(1000) > 4.5 && Math.abs(ldr(10) - 2) < 1e-9 && ldr(0.1) < 0.5, `${ldr(1000)} ${ldr(10)} ${ldr(0.1)}`); // mais luz, mais tensão
  }],
  ['Solver CC: botão com pull-down de 10 kΩ (exemplo Button do Arduino) lê 0 solto e 1 apertado', () => {
    const pin = pressed => Circuit.logicLevel(Circuit.solve({ sources: [{ node: '5V', volts: 5, r: 0 }, { node: 'GND', volts: 0, r: 0 }], shorts: [['5V', 'btn1'], ...(pressed ? [['btn1', 'D2']] : [])], resistors: [['D2', 'GND', 10e3]] }).volts('D2'));
    assert.equal(pin(false), 0); assert.equal(pin(true), 1);
  }],
  ['Solver CC: pull-up interno de 35 kΩ e botão ao GND; pino solto sem pull-up flutua', () => {
    const v = pressed => Circuit.solve({ sources: [{ node: 'D2', volts: 5, r: Circuit.PULLUP_R }, { node: 'GND', volts: 0, r: 0 }], shorts: pressed ? [['D2', 'GND']] : [] }).volts('D2');
    assert.equal(Circuit.logicLevel(v(false)), 1); assert.equal(Circuit.logicLevel(v(true)), 0);
    assert.equal(Circuit.logicLevel(Circuit.solve({ sources: [{ node: 'GND', volts: 0, r: 0 }], resistors: [] }).volts('D7')), null);
  }],
  ['Solver CC: LED vermelho com 220 Ω num pino a 5 V passa ~11,9 mA; invertido não acende; sem resistor passa do limite', () => {
    const led = (a, k, r) => Circuit.solve({ sources: [{ node: 'pin', volts: 5, r: Circuit.PIN_R }, { node: 'GND', volts: 0, r: 0 }], resistors: r ? [['pin', 'x', r]] : [], shorts: r ? [] : [['pin', 'x']], diodes: [{ a: a === 'pin' ? 'x' : 'GND', k: k === 'GND' ? 'GND' : 'x', vf: Circuit.ledVf('red'), rs: 15 }] }).diodeCurrent[0];
    near(led('pin', 'GND', 220) * 1e3, (5 - 1.9) / (25 + 220 + 15) * 1e3, 0.01); assert.equal(led('GND', 'pin', 220), 0);
    assert.ok(led('pin', 'GND', 0) * 1e3 > 40, 'sem resistor deveria passar de 40 mA');
  }],
  ['Solver CC: dois LEDs vermelhos em série acendem com 5 V; três não (precisam de 5,7 V)', () => {
    const chain = vfs => { const nodes = ['p', ...vfs.map((_, i) => 'n' + i)]; return Circuit.solve({ sources: [{ node: 'p', volts: 5, r: 0 }, { node: nodes.at(-1), volts: 0, r: 0 }], resistors: [], diodes: vfs.map((vf, i) => ({ a: nodes[i], k: nodes[i + 1], vf, rs: 15 })) }).diodeCurrent; };
    assert.ok(chain([1.9, 1.9]).every(i => i > 0)); assert.ok(chain([1.9, 1.9, 1.9]).every(i => i === 0)); near(chain([1.9, 1.9])[0], (5 - 3.8) / 30, 1e-9);
  }],
  ['Solver CC: curto entre 5 V e GND é apontado', () => {
    const r = Circuit.solve({ sources: [{ node: 'a', volts: 5, r: 0 }, { node: 'b', volts: 0, r: 0 }], shorts: [['a', 'b']] });
    assert.equal(r.conflicts.length, 1);
  }],
];
let passed = 0;
for (const [name, fn] of cases) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } }
console.log(`${passed}/${cases.length} testes do editor passaram`);
