// Contrato dos projetos do manifesto (examples/index.json): cada pasta sobe pelo rig (circuito + firmware, sem fiação à mão),
// todas as peças com `fw` no catálogo ficam ligadas, o firmware dá boot (linha "ready") e a placa sai roteada e sem violações.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createRig } from '../src/core/rig.mjs';
import { designBoard } from '../src/pcb/pcb.mjs';

const catalog = createRequire(import.meta.url)('../src/parts/catalog.js');
const root = new URL('../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const manifest = JSON.parse(read('examples/index.json'));
const results = [], test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const ok = (c, m) => { if (!c) throw Error(m || 'falhou'); };

test('Manifesto: ids únicos e todos os arquivos existem', () => {
  const ids = manifest.projects.map(p => p.id); ok(new Set(ids).size === ids.length, 'id repetido');
  for (const p of manifest.projects) for (const k of ['circuit', 'firmware', 'source', 'pcb']) if (p[k]) ok(existsSync(new URL(p[k], root)), `${p.id}: ${p[k]} não existe`);
});
for (const p of manifest.projects) {
  test(`${p.id}: sobe pelo rig, liga todas as peças e dá boot`, () => {
    const circuit = JSON.parse(read(p.circuit)), rig = createRig({ hex: read(p.firmware), circuit, catalog });
    ok(!rig.notes.length, rig.notes.join(' | '));
    const want = circuit.parts.filter(x => catalog.get(x.type)?.fw && x !== rig.board).map(x => x.id).sort(), got = rig.bound.map(b => b.part.id).sort();
    ok(JSON.stringify(want) === JSON.stringify(got), `ligadas ${got} ≠ esperadas ${want}`);
    let out = ''; rig.mcu.onSerial = b => { out += String.fromCharCode(b); }; rig.mcu.runSeconds(2.5);
    ok(out.includes(p.ready), `não achei "${p.ready}" em: ${out.slice(0, 120)}`);
  });
  test(`${p.id}: placa ${p.pcb ? 'própria' : 'do circuito'} 100 % roteada e sem violações`, () => {
    const c = JSON.parse(read(p.pcb || p.circuit)), d = designBoard(c, p.pcb ? { shape: 'round', d: 40 } : { shape: 'rect', w: 60, h: 40 }, undefined, null, catalog);
    ok(!d.errors.length, d.errors.join(' ')); ok(!d.routed.unrouted.length && d.drc.ok, `${d.routed.unrouted.length} sem rota, ${d.drc.violations.length} violações`);
  });
}
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${results.filter(x => x.pass).length}/${results.length} testes de projetos passaram`); if (results.some(x => !x.pass)) process.exitCode = 1; }
export { results };
