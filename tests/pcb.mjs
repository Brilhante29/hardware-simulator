// PCB: netlist do circuito, posicionamento na placa redonda, roteamento completo, DRC que acha defeitos de verdade e
// arquivos de fabricação bem formados (Gerber, Excellon, .zip). O exemplo é o relógio em placa própria (ATmega328P).
import { readFileSync } from 'node:fs';
import { buildNetlist, designBoard, drc, RULES, insideBoard, courtyard } from '../src/pcb/pcb.mjs';
import { gerberFiles, excellon, fabricationModel, fabricationZip, bom, cpl } from '../src/pcb/gerber.mjs';

const results = [], test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const ok = (c, m) => { if (!c) throw Error(m || 'falhou'); };
const circuit = JSON.parse(readFileSync(new URL('../examples/pcb/relogio-placa.json', import.meta.url), 'utf8'));
const design = designBoard(circuit, { shape: 'round', d: 40 });

test('Netlist: TQFP-32 com GND/VCC repetidos, módulos viram conectores, trilho de 5 V vira J0', () => {
  const nl = buildNetlist(circuit), u1 = nl.comps.find(c => c.ref === 'U1');
  ok(u1.fp.name.startsWith('TQFP-32') && u1.padNets.filter(n => n === 'GND').length === 3 && u1.padNets.filter(n => n === '+5V').length === 3, 'GND×3 e VCC+AVCC no +5V');
  ok(nl.comps.filter(c => c.module).length === 3 && nl.comps.some(c => c.ref === 'J0'), nl.comps.map(c => c.ref).join());
  const a4 = nl.nets.find(n => n.name === 'A4'); ok(a4 && a4.pads.length === 4, 'SDA no U1 + 3 módulos');
});
test('Arduino Uno numa PCB própria é recusado com a alternativa', () => { const r = buildNetlist({ parts: [{ id: 'u', type: 'uno', name: 'Uno' }], wires: [] }); ok(/ATmega328P/.test(r.errors[0]), r.errors[0]); });
test('Placa redonda Ø40 mm: tudo dentro, sem sobreposição, 100 % roteado e DRC limpo', () => {
  ok(design.board.d === 40, `Ø${design.board.d}`); ok(!design.routed.unrouted.length, JSON.stringify(design.routed.unrouted)); ok(design.drc.ok, JSON.stringify(design.drc.violations.slice(0, 3)));
  design.nl.comps.forEach((c, i) => { const b = courtyard(c, design.placements[i]); ok([[b.x0, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x1, b.y0]].every(([x, y]) => insideBoard(design.board, x, y)), c.ref); });
});
test('DRC não é de enfeite: trilha atravessando outra rede, peça fora da placa e ligação faltando são apontadas', () => {
  const t = design.routed.traces.find(s => s.net === 'A4' && s.layer === 0), other = design.routed.traces.find(s => s.net === 'A5' && s.layer === 0);
  const bad = { ...design.routed, traces: [...design.routed.traces, { net: 'A4', layer: 0, x1: other.x1, y1: other.y1, x2: other.x2, y2: other.y2, w: RULES.trace }] };
  ok(drc(design.nl, design.placements, design.board, bad).violations.some(v => v.type === 'curto'), 'curto não detectado');
  const pl = design.placements.map((p, i) => i === 1 ? { ...p, x: 1, y: 1 } : p); ok(drc(design.nl, pl, design.board, design.routed).violations.some(v => v.type === 'posição'), 'fora da placa');
  const cut = { ...design.routed, traces: design.routed.traces.filter(s => s !== t) }; ok(drc(design.nl, design.placements, design.board, cut).open.some(o => o.net === 'A4'), 'aberto não detectado');
});
test('Placa pequena demais cresce até caber', () => { const d = designBoard(circuit, { shape: 'round', d: 22 }); ok(d.board.d > 22 && d.board.d <= 40 && d.drc.stats.traces > 0, `Ø${d.board.d}`); });
test('Gerber RS-274X: formato 4.6 em mm, aberturas definidas antes do uso, M02 no fim, contorno em arco', () => {
  const g = gerberFiles(fabricationModel(design), RULES);
  for (const [name, text] of Object.entries(g)) {
    ok(text.includes('%FSLAX46Y46*%') && text.includes('%MOMM*%') && text.trimEnd().endsWith('M02*'), name);
    const defined = new Set([...text.matchAll(/%ADD(\d+)/g)].map(m => m[1])); for (const m of text.matchAll(/^D(\d+)\*$/gm)) ok(defined.has(m[1]), `${name}: D${m[1]} sem %ADD`);
    ok(/^[\x20-\x7e\n]*$/.test(text), `${name}: caractere fora do ASCII`);
  }
  ok(/G75\*[\s\S]*G03X40000000Y20000000I-20000000J0D01\*/.test(g['pcb-Edge_Cuts.gko']), 'círculo de 40 mm');
  const m = fabricationModel(design), flashes = (g['pcb-F_Cu.gtl'].match(/D03\*/g) || []).length; ok(flashes === m.pads.length + design.routed.vias.length, `${flashes} flashes`);
});
test('Excellon: um furo por via e por pad furado, ferramentas em mm', () => {
  const m = fabricationModel(design), e = excellon(m, RULES), holes = (e.match(/^X[\d.]+Y[\d.]+$/gm) || []).length;
  ok(holes === design.routed.vias.length + m.pads.filter(p => p.drill).length, `${holes} furos`); ok(/METRIC/.test(e) && /T1C0\.300/.test(e) && e.trimEnd().endsWith('M30'));
});
test('BOM e posição: uma linha por valor, uma por componente, coordenadas dentro da placa', () => {
  const b = bom(design).trim().split('\n'), c = cpl(design).trim().split('\n');
  ok(b[0].startsWith('Comment,Designator') && b.some(l => /^10 kΩ,R2 R3,/.test(l)), b.join(' | '));
  ok(c.length === design.nl.comps.length + 1 && c.slice(1).every(l => { const [, x, y] = l.split(','); return parseFloat(x) >= 0 && parseFloat(x) <= 40 && parseFloat(y) >= 0 && parseFloat(y) <= 40; }));
});
test('.zip: 11 arquivos, cabeçalhos e CRC32 conferem', () => {
  const z = fabricationZip(design, RULES, 'teste'), dv = new DataView(z.buffer); let off = 0, n = 0;
  const crcT = Array.from({ length: 256 }, (_, k) => { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  while (dv.getUint32(off, true) === 0x04034b50) { const crc = dv.getUint32(off + 14, true), size = dv.getUint32(off + 18, true), nl = dv.getUint16(off + 26, true), data = z.subarray(off + 30 + nl, off + 30 + nl + size); let c = 0xffffffff; for (const x of data) c = crcT[(c ^ x) & 255] ^ (c >>> 8); ok(((c ^ 0xffffffff) >>> 0) === crc, 'CRC'); off += 30 + nl + size; n++; }
  ok(n === 11, `${n} arquivos`);
});
test('Desempenho: netlist + posição + roteamento + DRC do relógio em menos de 3 s', () => { const t = performance.now(); designBoard(circuit, { shape: 'round', d: 40 }); const ms = performance.now() - t; ok(ms < 3000, `${ms.toFixed(0)} ms`); });

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${results.filter(x => x.pass).length}/${results.length} testes de PCB passaram`); if (results.some(x => !x.pass)) process.exitCode = 1; }
export { results };
