// Circuito → dispositivos emulados. A única função que sabe transformar "peça ligada nos pinos X e Y da placa" em
// "dispositivo plugado no barramento do chip". Usada pelo editor, pelo rig sem tela (vitrines, testes, CLI) e por
// qualquer ferramenta futura. Não conhece peças pelo nome: lê a declaração `fw` de cada uma no catálogo.
//
//   bindCircuit({ mcu, board, io, parts, defFor, net, devices, now, settingsOf }) → { bound, driven, notes }
//   - net(partId, pin) devolve a chave da rede (qualquer valor comparável); peças em redes da placa são ligadas.
//   - devices: o módulo de dispositivos (src/emulator/devices.mjs) ou qualquer objeto { NomeDaClasse: classe }.
//   - bound: [{ part, device, def }]; driven: pinos da placa que passam a ser dirigidos por uma peça (ex.: ECHO);
//     notes: motivos de peças que não puderam ser ligadas (pino faltando, classe desconhecida).

export function bindCircuit({ mcu, board, io, parts, defFor, net, devices, now = Date.now(), settingsOf = p => p.settings || {} }) {
  const bound = [], driven = new Set(), notes = [];
  const boardNet = new Map(io.pins.map(l => [net(board.id, l), l]));
  const pinOf = (p, pin) => boardNet.get(net(p.id, pin));
  const value = v => v === '$now' ? now : v;
  for (const part of parts) {
    if (part === board) continue;
    const def = defFor(part.type), fw = def?.fw; if (!fw) continue;
    const Device = devices[fw.device]; if (!Device) { notes.push(`${part.name}: dispositivo ${fw.device} não existe no emulador.`); continue; }
    const options = Object.fromEntries(Object.entries(fw.options || {}).map(([k, v]) => [k, value(v)]));
    if (fw.bus === 'i2c') {
      if (net(part.id, 'SDA') !== net(board.id, io.sda) || net(part.id, 'SCL') !== net(board.id, io.scl)) continue; // outro barramento
      let address = fw.address; const sel = fw.addressSetting; if (sel && settingsOf(part)[sel.key] in sel) address = sel[settingsOf(part)[sel.key]];
      const device = new Device({ ...options, address }); mcu.attachI2C(address, device); bound.push({ part, device, def });
      continue;
    }
    const resolve = (map, required) => {
      const out = {}; for (const [k, v] of Object.entries(map || {})) { out[k] = Array.isArray(v) ? v.map(x => pinOf(part, x)) : pinOf(part, v); }
      const missing = Object.entries(out).filter(([, v]) => Array.isArray(v) ? v.some(x => !x) : !v).map(([k]) => k);
      if (required && missing.length) return { missing };
      for (const k of missing) out[k] = null; return { out };
    };
    if (fw.bus === 'spi' && (pinOf(part, fw.sck) !== io.sck || pinOf(part, fw.mosi) !== io.mosi)) { if (pinOf(part, fw.sck) || pinOf(part, fw.mosi)) notes.push(`${part.name}: ${fw.sck}/${fw.mosi} precisam ir no SCK/MOSI da placa (${io.sck}/${io.mosi}).`); continue; }
    if (fw.bus !== 'pin' && fw.bus !== 'spi') { notes.push(`${part.name}: barramento ${fw.bus} desconhecido.`); continue; }
    const at = pinOf(part, fw.attach); if (!at) continue;                       // peça não ligada a esta placa
    const req = resolve(fw.pins, true); if (req.missing) { notes.push(`${part.name}: ligue ${req.missing.join(', ')} na placa.`); continue; }
    const opt = resolve(fw.optional, false).out;
    const device = new Device({ ...options, ...req.out, ...opt }); mcu.attachPinDevice(at, device);
    for (const pin of fw.driven || []) driven.add(pinOf(part, pin));
    bound.push({ part, device, def });
  }
  return { bound, driven, notes };
}

// Controles de sensor (sliders do catálogo) → dispositivo: o dispositivo decide com setControl, senão vira propriedade.
export function applyControls(def, part, device) {
  for (const [key, , , , , , dflt] of def.controls || []) {
    const v = part.settings?.sensor?.[key] ?? dflt;
    if (device.setControl) device.setControl(key, v); else device[key] = v;
  }
}

// Redes a partir dos fios de um circuito salvo (sem solver): union-find de "peça:pino".
export function wireNets(circuit) {
  const parent = new Map(), find = x => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  for (const w of circuit.wires || []) { const a = find(`${w.a.part}:${w.a.pin}`), b = find(`${w.b.part}:${w.b.pin}`); if (a !== b) parent.set(a, b); }
  return (part, pin) => find(`${part}:${pin}`);
}
