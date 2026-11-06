// Testes do interpretador de sketches do editor livre (src/editor/sketch.js).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { parse, timeline } = require('../src/editor/sketch.js');

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
];
let passed = 0;
for (const [name, fn] of cases) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } }
console.log(`${passed}/${cases.length} testes do editor passaram`);
