// Modelos elétricos das peças do editor (código, enquanto o catálogo é só dado). Cada modelo é uma unidade independente,
// achada pelo tipo da peça (ou pelo `kind` do catálogo, ou pelo campo `board`) e usada pelo laço genérico do editor:
//   stamp(c)    → entra no solver de CC: c.add.resistor(a, b, Ω) | short(a, b) | source({ node, volts, r, pin? })
//                 | diode(a, k, vf, rs, tag) | current({ a, b, amps }) | capacitor({ a, b, farads, v0, dt }, peça)
//   settle(c)   → estado discreto depois de uma solução (NPN em corte/ativa/saturação, relé, porta lógica); o editor
//                 repete stamp+settle até o estado parar de mudar
//   conducts(p) → pares de pinos ligados direto (grafo de conectividade do modo sketch)
//   rails(p)    → { high: [pinos], low: [pinos] } para o modo sketch
//   clear(p)    → zera o estado visual antes de observar; diode(p, extra, mA, c) → leitura de cada diodo marcado;
//   pwm: [de, para] repassa o ciclo de PWM entre pinos; timeDependent: precisa de passos de tempo; clicks: faz som ao mudar
//   observe(c)  → estado visual e avisos a partir das tensões (c.V(pino)), do PWM (c.dutyOf) e do tone (c.toneOf)
// c = { p, s, def, n(pino), C (circuit.js), add, state, V, dutyOf, toneOf, dt }
(function (root) {
  const two = (p, def) => [def.pins[0][0], def.pins[1][0]];
  const M = {
    resistor: { stamp: c => c.add.resistor(c.n('1'), c.n('2'), c.C.ohms(c.s.value || '220 Ω')), conducts: (p, def) => [two(p, def)] },
    pot: { stamp: c => { const pos = Math.max(0, Math.min(1, c.s.position ?? 0.5)); c.add.resistor(c.n('VCC'), c.n('SIG'), 1e4 * (1 - pos) + 1); c.add.resistor(c.n('SIG'), c.n('GND'), 1e4 * pos + 1); } },
    ldr: { stamp: c => c.add.resistor(c.n('1'), c.n('2'), c.C.ldrOhms(c.s.sensor?.lux ?? 300)) },
    led: {
      stamp: c => c.add.diode(c.n('A'), c.n('K'), c.C.ledVf(c.s.color), 15),
      diode: (p, _, mA, c) => { const d = c.dutyOf(['A', 'K']); p.settings.lit = mA > 0.3; p.settings.current = mA * d; p.settings.duty = p.settings.lit ? Math.min(1, Math.max(0.25, mA / 12)) * d : undefined; if (mA > 30) p.settings.warn = `${mA.toFixed(0)} mA no LED (máx. 20 mA contínuos, 30 mA absoluto): falta um resistor de ~220 Ω.`; },
    },
    rgb: {
      stamp: c => [['R', '#ff0000'], ['G', '#00ff00'], ['B', '#0000ff']].forEach(([ch, col]) => c.add.diode(c.n(ch), c.n('COM'), c.C.ledVf(col), 15, ch)),
      clear: p => { p.settings.rgb = [0, 0, 0]; },
      diode: (p, ch, mA, c) => { p.settings.rgb['RGB'.indexOf(ch)] = Math.min(1, mA / 10) * c.dutyOf([ch]); if (mA > 30) p.settings.warn = `${mA.toFixed(0)} mA no ${ch}: falta resistor.`; },
      observe: c => { c.p.settings.lit = c.p.settings.rgb.some(x => x > 0.02); },
    },
    segment: {
      stamp: c => { for (const ch of 'ABCDEFG') c.add.diode(c.n(ch), c.n('COM'), 1.9, 20, ch); },
      clear: p => { p.settings.segs = ''; },
      diode: (p, ch, mA) => { if (mA > 0.3) p.settings.segs += ch; },
      observe: c => { c.p.settings.lit = !!c.p.settings.segs; },
    },
    diode: { stamp: c => c.add.diode(c.n('A'), c.n('K'), 0.7, 0.5), diode: (p, _, mA) => { p.settings.lit = mA > 0.1; } },
    // NPN: corte, saturação (C–E 0,5 Ω) ou região ativa (Ic = hFE·Ib, fonte de corrente C→E). Ic acima do máximo do
    // catálogo (limits.icMax) vira aviso, como queimaria um transistor de sinal.
    transistor: {
      pwm: ['B', 'C'],   // chaveado por PWM: o coletor segue o ciclo de trabalho da base
      stamp: c => { c.add.diode(c.n('B'), c.n('E'), 0.7, 10, 'vbe'); const t = c.state; if (t?.mode === 'sat') c.add.resistor(c.n('C'), c.n('E'), 0.5); else if (t?.mode === 'active') c.add.current({ a: c.n('C'), b: c.n('E'), amps: c.C.HFE * t.ib }); },
      settle: c => { const ib = c.diodeCurrent('vbe'), prev = c.state?.mode || 'off', vce = (c.V('C') ?? 0) - (c.V('E') ?? 0); let mode = 'off'; if (ib > 1e-6) { if (prev === 'sat') mode = vce / 0.5 > c.C.HFE * ib ? 'active' : 'sat'; else if (prev === 'active') mode = vce < 0.2 ? 'sat' : 'active'; else mode = 'sat'; } return { mode, ib: mode === 'off' ? 0 : ib }; },
      observe: c => { const st = c.state; c.p.settings.on = !!st && st.mode !== 'off'; c.p.settings.mode = st?.mode; const ic = st?.mode === 'active' ? c.C.HFE * st.ib : st?.mode === 'sat' ? Math.abs(((c.V('C') ?? 0) - (c.V('E') ?? 0)) / 0.5) : 0, max = c.def.limits?.icMax; if (max && ic > max) c.p.settings.warn = `Ic de ${(ic * 1e3).toFixed(0)} mA passa dos ${max * 1e3} mA do transistor: use um MOSFET ou um transistor de potência.`; },
    },
    capacitor: {
      timeDependent: true,
      stamp: c => c.add.capacitor({ a: c.n('+'), b: c.n('−'), farads: c.C.farads(c.s.value || '100 µF'), v0: c.p._vc || 0, dt: c.dt }, c.p),
      observe: c => { const p = c.p, vc = p._vc || 0, rated = parseFloat(String(p.settings.rating || '16').replace(',', '.')) || 16; p.settings.vc = vc; if (vc < -1) p.settings.warn = `Eletrolítico invertido: ${vc.toFixed(1)} V. No real ele aquece, vaza e pode estufar.`; else if (vc > rated) p.settings.warn = `${vc.toFixed(1)} V acima dos ${rated} V nominais do capacitor.`; },
    },
    buzzer: {
      stamp: c => c.add.resistor(c.n('+'), c.n('−'), 170),
      observe: c => { const hz = c.toneOf('+'), a = c.V('+'), b = c.V('−'); c.p.settings.tone = hz && b !== undefined && b < 1 ? hz : undefined; c.p.settings.lit = !!c.p.settings.tone || (a !== undefined && b !== undefined && a - b >= 3); },
    },
    // Motor: a velocidade persegue o alvo com inércia (τ ≈ 0,15 s de um motor pequeno), em vez de saltar.
    motor: {
      stamp: c => c.add.resistor(c.n('+'), c.n('−'), Number(c.s.ohms) || 10),   // 10 Ω motor de brinquedo; ~40 Ω vibracall de moeda
      observe: c => { const p = c.p, a = c.V('+'), b = c.V('−'), v = a !== undefined && b !== undefined ? a - b : 0, target = Math.max(-1, Math.min(1, v / 5)) * c.dutyOf(['+', '−']), now = c.now, dt = p._t ? Math.min(0.2, (now - p._t) / 1000) : 1; p._t = now; const cur = p._speed ?? 0; p._speed = cur + (target - cur) * (1 - Math.exp(-dt / 0.15)); if (Math.abs(p._speed - target) < 0.005) p._speed = target; p.settings.speed = p._speed; p.settings.lit = Math.abs(p._speed) > 0.05; },
    },
    relay: {
      clicks: true,
      stamp: c => { if (c.state) c.add.resistor(c.n('VCC'), c.n('GND'), 70); c.add.short(c.n('COM'), c.state ? c.n('NO') : c.n('NC')); },
      settle: c => { const vcc = c.V('VCC'), gnd = c.V('GND'), vin = c.V('IN'), powered = vcc !== undefined && gnd !== undefined && vcc - gnd >= 3.5; return powered && vin !== undefined && ((c.s.trigger || 'HIGH') === 'LOW' ? vin - gnd <= 1.5 : vin - gnd >= 2.5); },
      observe: c => { c.p.settings.on = !!c.state; },
    },
    gate: {
      stamp: c => { if (c.state === 0 || c.state === 1) c.add.source({ node: c.n('Y'), volts: c.state * 5, r: c.C.PIN_R }); },
      settle: c => { const a = c.C.logicLevel(c.V('A')), b = c.C.logicLevel(c.V('B')); return a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : null; },
      observe: c => { c.p.settings.out = c.state; },
    },
    source: {
      stamp: c => { c.add.source({ node: c.n('+'), volts: Number(c.s.voltage) || 5, r: 0 }); c.add.source({ node: c.n('−'), volts: 0, r: 0 }); },
      rails: () => ({ high: ['+'], low: ['−'] }),
    },
  };
  // Modelos por `kind` do catálogo (peças personalizadas e trilhos).
  const KIND = {
    conductor: { stamp: c => c.add.short(...two(c.p, c.def).map(c.n)), conducts: (p, def) => [two(p, def)] },
    switch: { stamp: c => { if (c.s.pressed) c.add.short(...two(c.p, c.def).map(c.n)); }, conducts: (p, def) => p.settings?.pressed ? [two(p, def)] : [] },
    source: { stamp: c => { c.add.source({ node: c.n(c.def.pins[0][0]), volts: Number(c.s.voltage) || 5, r: 0 }); c.add.source({ node: c.n(c.def.pins[1][0]), volts: 0, r: 0 }); }, rails: (p, def) => ({ high: [def.pins[0][0]], low: [def.pins[1][0]] }) },
    highRail: { stamp: c => c.add.source({ node: c.n(c.def.pins[0][0]), volts: 5, r: 0 }), rails: (p, def) => ({ high: [def.pins[0][0]], low: [] }) },
    lowRail: { stamp: c => c.add.source({ node: c.n(c.def.pins[0][0]), volts: 0, r: 0 }), rails: (p, def) => ({ high: [], low: [def.pins[0][0]] }) },
  };
  M.button = KIND.switch; M.switch = KIND.switch;
  // Placa ou chip: 5 V/GND da placa (o chip nu não gera tensão) e cada pino de saída como fonte com 25 Ω; pull-up de 35 kΩ.
  const BOARD = {
    stamp: c => {
      const io = c.def.board, sup = io.bare ? (c.p._supply ?? 0) : 5;
      if (io.bare) c.add.short(c.n('GND'), c.n('GND2')); else { c.add.source({ node: c.n('5V'), volts: 5, r: 0 }); c.add.source({ node: c.n('GND'), volts: 0, r: 0 }); }
      for (const label of io.pins) { if (!c.def.pins.some(p => p[0] === label)) continue; const lv = c.s.outputs?.[label];
        if (sup > 0 && (lv === 0 || lv === 1)) c.add.source({ node: c.n(label), volts: sup * lv, r: c.C.PIN_R, pin: [c.p, label] });
        else if (sup > 0 && c.s.modes?.[label] === 'input_pullup') c.add.source({ node: c.n(label), volts: sup, r: c.C.PULLUP_R }); }
    },
    rails: (p, def) => ({ high: def.board.bare ? [] : ['5V'], low: ['GND'], outputs: true }),
  };
  const modelFor = def => def ? (def.board ? BOARD : M[def.type] || KIND[def.kind] || null) : null;
  const api = { models: M, kinds: KIND, board: BOARD, modelFor };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.HSModels = api;
})(typeof window !== 'undefined' ? window : globalThis);
