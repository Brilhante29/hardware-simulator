// Comportamento elétrico do editor no navegador real (Playwright + Chromium): circuitos clássicos montados por código,
// resolvidos pelo solver de CC e lidos do estado visual das peças. Protege os modelos elétricos (src/parts/models.js).
// Uso: node tests/browser.mjs   (sobe o próprio servidor; precisa do pacote playwright com Chromium)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { startServer } from '../tools/studio-server.mjs';

const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { console.log('playwright não instalado: testes de navegador pulados'); process.exit(0); }
const results = [];
const srv = await startServer({ port: 0, log: () => {} }), browser = await chromium.launch(), page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${srv.port}/editor.html`); await page.waitForFunction(() => typeof updateSimulation === 'function');

// Monta um circuito: peças [id, tipo, settings] e fios "peça.pino-peça.pino"; resolve e devolve o estado de cada peça.
const run = (parts, wires, steps = 1) => page.evaluate(([parts, wires, steps]) => {
  project = { version: 1, title: 't', parts: parts.map(([id, type, settings = {}], i) => ({ id, type, name: id, x: 100 + i * 140, y: 200, settings })), wires: wires.map((w, i) => { const [a, b] = w.split('-'), [pa, ia] = a.split('.'), [pb, ib] = b.split('.'); return { id: 'w' + i, a: { part: pa, pin: ia }, b: { part: pb, pin: ib } }; }), code: '' };
  circuitStates = {}; for (let k = 0; k < steps; k++) { solveCircuit(0.05); updateSimulation({ quiet: true }); }
  return Object.fromEntries(project.parts.map(p => [p.id, { ...p.settings, _vc: p._vc }]));
}, [parts, wires, steps]);
const test = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const ok = (c, m) => { if (!c) throw Error(m || 'falhou'); };
const SRC = ['b', 'source', { voltage: 5 }];

await test('LED com 220 Ω acende com ~13 mA; sem resistor avisa sobrecorrente', async () => {
  const a = await run([SRC, ['r', 'resistor', { value: '220 Ω' }], ['l', 'led', { color: '#e56d5c' }]], ['b.+-r.1', 'r.2-l.A', 'l.K-b.−']);
  ok(a.l.lit && Math.abs(a.l.current - 13.2) < 1.5, JSON.stringify(a.l));
  const b = await run([SRC, ['l', 'led', { color: '#e56d5c' }]], ['b.+-l.A', 'l.K-b.−']); ok(b.l.warn && /mA/.test(b.l.warn), JSON.stringify(b.l));
});
await test('Botão fecha o circuito só quando pressionado', async () => {
  const w = ['b.+-s.1', 's.2-r.1', 'r.2-l.A', 'l.K-b.−'], parts = p => [SRC, ['s', 'button', { pressed: p }], ['r', 'resistor', { value: '330 Ω' }], ['l', 'led', {}]];
  ok(!(await run(parts(false), w)).l.lit, 'aceso solto'); ok((await run(parts(true), w)).l.lit, 'apagado pressionado');
});
await test('NPN: 1 kΩ na base dá região ativa (Ic = hFE·Ib), 470 Ω satura; os dois giram o motor', async () => {
  const npn = rb => run([SRC, ['r', 'resistor', { value: rb }], ['q', 'transistor', {}], ['m', 'motor', {}]], ['b.+-r.1', 'r.2-q.B', 'q.E-b.−', 'q.C-m.−', 'm.+-b.+'], 4);
  const a = await npn('1 kΩ'), b = await npn('470 Ω');
  ok(a.q.mode === 'active' && a.m.speed > 0, JSON.stringify([a.q, a.m.speed])); ok(b.q.mode === 'sat' && b.m.speed > 0, JSON.stringify([b.q, b.m.speed]));
});
await test('Relé alimentado com IN alto fecha COM–NO e acende o LED', async () => {
  const a = await run([SRC, ['k', 'relay', {}], ['r', 'resistor', { value: '220 Ω' }], ['l', 'led', {}]], ['b.+-k.VCC', 'k.GND-b.−', 'k.IN-b.+', 'b.+-k.COM', 'k.NO-r.1', 'r.2-l.A', 'l.K-b.−'], 3);
  ok(a.k.on && a.l.lit, JSON.stringify([a.k.on, a.l.lit]));
});
await test('LED RGB só no vermelho e 7 segmentos com A aceso', async () => {
  const a = await run([SRC, ['r', 'resistor', { value: '220 Ω' }], ['c', 'rgb', {}], ['r2', 'resistor', { value: '220 Ω' }], ['s', 'segment', {}]], ['b.+-r.1', 'r.2-c.R', 'c.COM-b.−', 'b.+-r2.1', 'r2.2-s.A', 's.COM-b.−']);
  ok(a.c.rgb[0] > 0.3 && a.c.rgb[1] === 0 && a.c.rgb[2] === 0, JSON.stringify(a.c.rgb)); ok(a.s.segs === 'A', a.s.segs);
});
await test('Capacitor carrega pelo resistor ao longo do tempo (RC)', async () => {
  const a = await run([SRC, ['r', 'resistor', { value: '1 kΩ' }], ['c', 'capacitor', { value: '100 µF' }]], ['b.+-r.1', 'r.2-c.+', 'c.−-b.−'], 6);
  ok(a.c._vc > 0.5 && a.c._vc < 5, `vc=${a.c._vc}`);
});
await test('Porta AND, potenciômetro no meio, buzzer e diodo reverso', async () => {
  const g = await run([SRC, ['g', 'gate', {}]], ['b.+-g.A', 'b.+-g.B'], 3); ok(g.g.out === 1, JSON.stringify(g.g));
  const z = await run([SRC, ['z', 'buzzer', {}]], ['b.+-z.+', 'z.−-b.−']); ok(z.z.lit, 'buzzer');
  const d = await run([SRC, ['r', 'resistor', { value: '1 kΩ' }], ['d', 'diode', {}]], ['b.+-r.1', 'r.2-d.K', 'd.A-b.−']); ok(!d.d.lit, 'diodo reverso conduzindo');
  const p = await page.evaluate(() => { project = { version: 1, title: 'p', parts: [{ id: 'b', type: 'source', name: 'b', x: 0, y: 0, settings: { voltage: 5 } }, { id: 'p', type: 'pot', name: 'p', x: 0, y: 0, settings: { position: 0.5 } }], wires: [{ id: 'w1', a: { part: 'b', pin: '+' }, b: { part: 'p', pin: 'VCC' } }, { id: 'w2', a: { part: 'p', pin: 'GND' }, b: { part: 'b', pin: '−' } }], code: '' }; return solveCircuit(0).volts('p:SIG'); });
  ok(Math.abs(p - 2.5) < 0.05, `pot ${p}`);
});
await test('Inspector gerado pelo catálogo: valor do resistor, tensão da fonte e gatilho do relé mudam o circuito', async () => {
  await run([SRC, ['r', 'resistor', { value: '220 Ω' }], ['l', 'led', {}]], ['b.+-r.1', 'r.2-l.A', 'l.K-b.−']);
  const edit = (id, key, value) => page.evaluate(([id, key, value]) => { selectedId = id; renderInspector(); const el = document.querySelector(`[data-setting="${key}"]`); el.value = value; el.dispatchEvent(new Event(el.type === 'range' ? 'input' : 'change')); solveCircuit(0); updateSimulation({ quiet: true }); return project.parts.find(p => p.id === 'l').settings.current; }, [id, key, value]);
  const base = await edit('r', 'value', '220 Ω'), more = await edit('r', 'value', '1 kΩ'), lower = await edit('b', 'voltage', '3.3');
  ok(base > 12 && more < 4 && lower < more, JSON.stringify([base, more, lower]));
  const bad = await page.evaluate(() => { selectedId = 'b'; renderInspector(); const el = document.querySelector('[data-setting="voltage"]'); el.value = '99'; el.dispatchEvent(new Event('input')); return project.parts.find(p => p.id === 'b').settings.voltage; });
  ok(bad === 12, `fonte deveria travar no máximo do catálogo (12 V): ${bad}`);
});
// Com firmware real: as saídas declaradas no catálogo (view.pulse, view.ws2812) e as telas pintadas pelo próprio dispositivo.
const fx = name => readFileSync(new URL(`./fixtures/avr/${name}.hex`, import.meta.url), 'utf8');
const runFw = async (hex, parts, wires, ms = 1200) => {
  await page.evaluate(() => { if (simulationTimer) runSimulation(); });
  await page.evaluate(([hex, parts, wires]) => { project = { version: 1, title: 'fw', parts: [{ id: 'u', type: 'uno', name: 'Uno', x: 300, y: 200, settings: { firmware: hex, firmwareName: 't' } }, ...parts.map(([id, type, settings = {}], i) => ({ id, type, name: id, x: 600, y: 100 + i * 120, settings }))], wires: wires.map((w, i) => { const [a, b] = w.split('-'), [pa, ia] = a.split('.'), [pb, ib] = b.split('.'); return { id: 'w' + i, a: { part: pa, pin: ia }, b: { part: pb, pin: ib } }; }), code: '' }; renderAll(); runSimulation(); }, [hex, parts, wires]);
  await page.waitForTimeout(ms);
  const r = await page.evaluate(() => ({ parts: Object.fromEntries(project.parts.map(p => [p.id, { ...p.settings, firmware: undefined }])), oled: project.parts.filter(p => p.type === 'oled').map(p => { const c = document.querySelector(`[data-part="${p.id}"] canvas`); const d = c.getContext('2d').getImageData(0, 0, 128, 64).data; let lit = 0; for (let i = 0; i < d.length; i += 4) lit += d[i + 1] > 150; return lit; }) }));
  await page.evaluate(() => runSimulation()); return r;
};
await test('Firmware: servo pelo pulso (view.pulse), NeoPixels pela cadeia DIN→DOUT (view.ws2812), OLED pintado pelo dispositivo', async () => {
  const s = await runFw(fx('servo'), [['sv', 'servo', {}]], ['sv.SIG-u.D9'], 1500); ok(Math.abs(s.parts.sv.angle - 90) <= 2, `servo ${s.parts.sv.angle}`);
  const n = await runFw(fx('neopixel'), [['n1', 'neopixel', {}], ['n2', 'neostrip', {}]], ['n1.DIN-u.D6', 'n1.DOUT-n2.DIN'], 600);
  // 2º quadro do firmware (degradê de 8 LEDs): o 1º vai para o NeoPixel avulso, os 7 seguintes para a fita, o 8º da fita fica apagado.
  ok(n.parts.n1.colors?.[0] === '#0064ff' && n.parts.n2.colors?.[0] === '#1e64e1' && n.parts.n2.colors.length === 8 && n.parts.n2.colors[7] === '#000000', JSON.stringify([n.parts.n1.colors, n.parts.n2.colors]));
  const o = await runFw(fx('oled'), [['o', 'oled', {}]], ['o.SDA-u.A4', 'o.SCL-u.A5'], 1500); ok(o.oled[0] > 300, `OLED com ${o.oled[0]} pontos acesos`);
});
await test('Chip nu: requisitos do catálogo (board.requires) recusam o boot sem cristal e deixam com cristal', async () => {
  const check = withXtal => page.evaluate(withXtal => { project = { version: 1, title: 'c', parts: [{ id: 'c', type: 'atmega328', name: 'U1', x: 300, y: 200, settings: {} }, { id: 'v', type: 'vcc', name: 'v', x: 0, y: 0, settings: {} }, { id: 'g', type: 'gnd', name: 'g', x: 0, y: 0, settings: {} }, ...(withXtal ? [{ id: 'y', type: 'crystal', name: 'Y1', x: 0, y: 0, settings: {} }] : [])],
    wires: [['c', 'VCC', 'v', 'VCC'], ['c', 'AVCC', 'v', 'VCC'], ['c', 'GND', 'g', 'GND'], ...(withXtal ? [['y', '1', 'c', 'XTAL1'], ['y', '2', 'c', 'XTAL2']] : [])].map(([a, pa, b, pb], i) => ({ id: 'w' + i, a: { part: a, pin: pa }, b: { part: b, pin: pb } })), code: '' };
    solveCircuit(0); updateSimulation({ quiet: true }); return bareChipCheck(project.parts[0], lastNet.find, lastNet.node); }, withXtal);
  const no = await check(false), yes = await check(true);
  ok(no.problems.some(p => /cristal/.test(p)), JSON.stringify(no)); ok(!yes.problems.length && yes.notes.some(n => /22 pF/.test(n)) && yes.notes.some(n => /desacoplamento/.test(n)), JSON.stringify(yes));
});
await test('Página de boot gerada pelo catálogo: LCD da bancada mostra o texto e o TMP117 entra só por ser ligado', async () => {
  const b = await browser.newPage(); const errs = []; b.on('pageerror', e => errs.push(e.message));
  await b.goto(`http://127.0.0.1:${srv.port}/boot.html`); await b.waitForSelector('[data-bench="tmp117"]');
  const types = await b.$$eval('[data-bench]', els => els.map(e => e.dataset.bench)); ok(['display', 'oled', 'gc9a01', 'max30102', 'tmp117', 'dht22', 'ultrasonic'].every(t => types.includes(t)), types.join());
  await b.setInputFiles('#fileInput', new URL('./fixtures/avr/lcd.hex', import.meta.url).pathname); await b.waitForTimeout(1600);
  const lcd = await b.textContent('[data-view="display"]'); ok(/\S/.test(lcd), `LCD vazio: ${JSON.stringify(lcd)}`);
  await b.check('[data-bench="tmp117"]'); await b.setInputFiles('#fileInput', new URL('./fixtures/avr/tmp117.hex', import.meta.url).pathname); await b.waitForTimeout(1500);
  const serial = await b.textContent('#serial'); ok(serial.includes('id=117') && serial.includes('t=36.60'), serial.slice(-160));
  ok(!errs.length, errs.join(' | ')); await b.close();
});
await test('Sem erros de JavaScript na página', async () => ok(!errors.length, errors.join(' | ')));

await browser.close(); srv.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`);
console.log(`${results.filter(x => x.pass).length}/${results.length} testes de navegador passaram`); if (results.some(x => !x.pass)) process.exitCode = 1;
