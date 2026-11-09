// Contrato das peças: cada entrada do catálogo é uma unidade completa e coerente. Se este teste passa, uma peça nova
// aparece na biblioteca, liga no firmware, entra na netlist e vira footprint sem mexer em editor, binder ou PCB.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as devices from '../src/emulator/devices.mjs';
import { FOOTPRINTS } from '../src/pcb/footprints.mjs';
import { footprintFor } from '../src/pcb/footprints.mjs';
import { createRig } from '../src/core/rig.mjs';
import { designBoard } from '../src/pcb/pcb.mjs';

const require = createRequire(import.meta.url), catalog = require('../src/parts/catalog.js');
const results = [], test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const ok = (c, m) => { if (!c) throw Error(m || 'falhou'); };
// A arte roda como no navegador (script clássico que publica window.PixelParts).
const sandbox = { window: {} }; vm.runInNewContext(readFileSync(new URL('../src/editor/parts-art.js', import.meta.url), 'utf8'), sandbox); const art = sandbox.window.PixelParts;
const pinNames = d => d.pins.map(p => p[0]);

test('O catálogo é só dado (sobrevive a JSON) e cada tipo aparece uma vez', () => {
  ok(JSON.stringify(catalog.parts) === JSON.stringify(JSON.parse(JSON.stringify(catalog.parts))), 'há funções ou valores não serializáveis');
  const types = catalog.parts.map(p => p.type); ok(new Set(types).size === types.length, 'tipo repetido');
});
for (const d of catalog.parts) {
  test(`${d.type}: pinos, controles, arte, firmware e PCB coerentes`, () => {
    const pins = pinNames(d); ok(pins.length && new Set(pins).size === pins.length, 'pinos repetidos ou vazios');
    for (const [n, x, y] of d.pins) ok(x >= 0 && x <= d.width && y >= 0 && y <= d.height, `pino ${n} fora da peça`);
    for (const c of d.controls || []) { const [k, , , min, max, step, dflt] = c; ok(typeof k === 'string' && min <= dflt && dflt <= max && step > 0, `controle ${k} malformado`); }
    const svg = art.art(d, { settings: {} }); ok(/^<svg[\s\S]*<\/svg>$/.test(svg) && svg.includes(`viewBox="0 0 ${d.width} ${d.height}"`), 'arte não renderiza');
    for (const f of d.settings || []) { ok(['range', 'select', 'text', 'color', 'check'].includes(f.kind) && f.key && f.label, `ajuste ${f.key} malformado`); if (f.kind === 'range') ok(f.min <= f.default && f.default <= f.max && f.step > 0, `faixa de ${f.key}`); if (f.kind === 'select') ok(f.options.includes(f.default), `padrão de ${f.key}`); }
    const v = d.view || {}; if (v.pulse) ok(pins.includes(v.pulse.pin) && v.pulse.minUs < v.pulse.maxUs && v.pulse.degrees > 0, 'view.pulse'); if (v.ws2812) ok(pins.includes(v.ws2812.din) && pins.includes(v.ws2812.dout) && v.ws2812.leds > 0, 'view.ws2812');
    if (d.momentary || d.states) ok(d.kind === 'switch' && (!d.states || d.states.length === 2), 'momentary/states só em chaves, com 2 rótulos');
    for (const r of d.board?.requires || []) { ok(r.problem || r.note, `requisito ${r.id} sem texto`); if (r.same) ok(r.same.every(x => pins.includes(x)), `requisito ${r.id}`); else { ok(catalog.get(r.part), `requisito ${r.id}: peça ${r.part} não existe`); ok([...r.between, ...(r.and || [])].every(x => pins.includes(x)), `requisito ${r.id}: pino`); } if (r.when) ok(d.board.requires.some(x => x.id === r.when), `requisito ${r.id}: when`); }
    if (d.board?.bare) ok(d.board.supply?.min < d.board.supply?.max, 'chip nu sem faixa de alimentação');
    if (d.board) for (const l of d.board.pins) ok(pins.includes(l), `pino de placa ${l} não existe na peça`);
    if (d.fw) {
      ok(typeof devices[d.fw.device] === 'function', `dispositivo ${d.fw.device} não existe em devices.mjs`);
      const refs = d.fw.bus === 'i2c' ? ['SDA', 'SCL'] : [d.fw.attach, d.fw.sck, d.fw.mosi, ...Object.values(d.fw.pins || {}).flat(), ...Object.values(d.fw.optional || {}), ...(d.fw.driven || [])].filter(Boolean);
      for (const r of refs) ok(pins.includes(r), `fw cita o pino ${r}, que a peça não tem`);
      if (d.fw.addressSetting) ok(Object.values(d.fw.addressSetting).some(v => typeof v === 'number'), 'addressSetting sem endereço alternativo');
      for (const [m] of d.events || []) ok(typeof devices[d.fw.device].prototype[m] === 'function', `evento ${m} não é método de ${d.fw.device}`);
      if (d.controls?.length) { const dev = new devices[d.fw.device]({}); for (const [k, , , , , , v] of d.controls) dev.setControl ? dev.setControl(k, v) : (dev[k] = v); }
    }
    if (d.pcb?.fp) {
      ok(FOOTPRINTS[d.pcb.fp], `footprint ${d.pcb.fp} não existe`);
      const pads = new Set(FOOTPRINTS[d.pcb.fp].pads.map(p => p.pin)), merged = d.pcb.merge || {};
      for (const p of pins) ok(pads.has(p) || pads.has(merged[p]), `pino ${p} sem pad no ${d.pcb.fp}`);
    }
    if (d.pcb?.header) ok(JSON.stringify([...d.pcb.header].sort()) === JSON.stringify([...pins].sort()), 'conector com pinos diferentes da peça');
    if (!d.pcb?.net && !d.pcb?.refuse) { const f = footprintFor({ type: d.type, name: d.name, settings: {} }, pins, d); ok(f && f.fp && f.ref, 'sem footprint nem conector'); }
  });
}
// Prova de extensão: o TMP117 entrou só com uma entrada no catálogo, a classe Tmp117 e nada mais. Aqui ele é montado num
// circuito novo, sobe pelo rig com firmware real e vira PCB, sem nenhuma linha específica dele fora desses dois lugares.
test('Peça nova por declaração: TMP117 liga no I²C (endereço pelo ADD0), responde ao firmware real e vira PCB', () => {
  const circuit = { parts: [{ id: 'n1', type: 'nano', name: 'Nano', settings: {} }, { id: 't1', type: 'tmp117', name: 'TMP117', settings: { sensor: { temperature: 37.8 } } }, { id: 'g', type: 'gnd', name: 'GND', settings: {} }, { id: 'v', type: 'vcc', name: '5 V', settings: {} }],
    wires: [['t1', 'SDA', 'n1', 'A4'], ['t1', 'SCL', 'n1', 'A5'], ['t1', 'VCC', 'v', 'VCC'], ['t1', 'GND', 'g', 'GND'], ['n1', 'GND', 'g', 'GND'], ['n1', '5V', 'v', 'VCC']].map(([a, pa, b, pb], i) => ({ id: 'w' + i, a: { part: a, pin: pa }, b: { part: b, pin: pb } })) };
  const hex = readFileSync(new URL('./fixtures/avr/tmp117.hex', import.meta.url), 'utf8'), rig = createRig({ hex, circuit, catalog });
  let out = ''; rig.mcu.onSerial = b => { out += String.fromCharCode(b); }; rig.mcu.runSeconds(0.8);
  ok(out.includes('id=117') && out.includes('t=37.80'), out);
  circuit.parts[1].settings.add0 = 'HIGH'; const moved = createRig({ hex, circuit, catalog }); ok(moved.bound[0].device.address === 0x49, 'ADD0 no VCC deveria ser 0x49');
  let out2 = ''; moved.mcu.onSerial = b => { out2 += String.fromCharCode(b); }; moved.mcu.runSeconds(0.3); ok(out2.includes('id=FFFF'), 'em 0x49 o firmware (que lê 0x48) deveria ler o barramento solto (0xFF, pull-up): ' + out2);
  const d = designBoard(circuit, { shape: 'rect', w: 40, h: 30 }, undefined, null, catalog); ok(d.nl.comps.some(c => c.value.includes('TMP117') && c.fp.pads.length === 4) && d.drc.ok, 'PCB');
});

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${results.filter(x => x.pass).length}/${results.length} testes de peças passaram`); if (results.some(x => !x.pass)) process.exitCode = 1; }
export { results };
