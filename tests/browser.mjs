// Comportamento elétrico do editor no navegador real (Playwright + Chromium): circuitos clássicos montados por código,
// resolvidos pelo solver de CC e lidos do estado visual das peças. Protege os modelos elétricos (src/parts/models.js).
// Uso: node tests/browser.mjs   (sobe o próprio servidor; precisa do pacote playwright com Chromium)
import { createRequire } from 'node:module';
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
await test('Sem erros de JavaScript na página', async () => ok(!errors.length, errors.join(' | ')));

await browser.close(); srv.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`);
console.log(`${results.filter(x => x.pass).length}/${results.length} testes de navegador passaram`); if (results.some(x => !x.pass)) process.exitCode = 1;
