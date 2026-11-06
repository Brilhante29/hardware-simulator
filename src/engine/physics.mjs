// Motor eletrotérmico da bancada: fonte de bancada (tensão constante com limite de corrente) → R1 → C1 ou D1.
// Cada número vem de um datasheet/nota de aplicação (SOURCES) ou é uma premissa declarada (ASSUMPTIONS).
// Integração: passo fixo; a tensão do capacitor é resolvida implicitamente (bisseção), então o modo "zener"
// de sobretensão não fica instável mesmo com passo de 5 ms.

const F = 96485, RGAS = 8.314, ATM = 101.325; // C/mol, J/(mol·K), kPa

export const SOURCES = Object.freeze({
  sfr25: { name: 'Vishay SFR25 (rev. 11-Feb-2025)', url: 'https://www.vishay.com/docs/28722/sfr25.pdf', facts: 'P70 = 0,4 W; Rth = 200 K/W; filme até 155 °C; tensão-limite 250 V; sobrecarga 6,25 × Pn por 5 s (≤ 2 × 250 V)' },
  cde: { name: 'Cornell Dubilier – Aluminum Electrolytic Capacitor Application Guide', url: 'https://www.cde.com/resources/technical-papers/KNO_CD_AEappGuide_R2.pdf', facts: 'Acima da tensão de surto a fuga fica muito alta, como um zener; hidrogênio gera pressão e falha. Reverso > 1,5 V danifica. Formação ≥ 35 % acima da nominal.' },
  nichicon: { name: 'Nichicon CAT.8101H – Technical Notes', url: 'https://www.nichicon.co.jp/english/products/pdf/aluminum.pdf', facts: 'A fuga sobe rápido acima da nominal; o calor reduz a isolação do anodo; a válvula libera eletrólito vaporizado e H₂ (não é fumaça de combustão) e deve abrir sem chamas nem fragmentos. Quanto maior a tensão, maior a chance de curto entre as folhas.' },
  kingbright: { name: 'Kingbright WP7113ID (V.14A)', url: 'https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf', facts: 'VF 1,9 V típ./2,3 V máx. a 10 mA; IF 30 mA; IFP 160 mA; PD 75 mW; VR 5 V; Tj 125 °C; RthJA 560 °C/W; −1,9 mV/°C' },
});

// Premissas: valores físicos plausíveis que os datasheets não trazem. Ficam expostos e editáveis.
export const ASSUMPTIONS = Object.freeze({
  resistorHeatCapacity: { value: 0.2, unit: 'J/K', why: 'Corpo 0207 (núcleo cerâmico ~2,5 × 6,5 mm, ~0,25 g × ~0,8 J/g·K).' },
  resistorScorch: { value: 230, unit: '°C', why: 'Laca de proteção começa a escurecer.' },
  resistorSmoke: { value: 330, unit: '°C', why: 'Pirólise da laca: fumaça visível.' },
  resistorOpen: { value: 650, unit: '°C', why: 'Filme metálico oxida e interrompe (abre).' },
  capFormationRatio: { value: 1.35, unit: '× VR', why: 'Nota CDE: formação ≥ 35 % acima da nominal.' },
  capZenerOnset: { value: 0.005, unit: 'A', why: 'Corrente de fuga em que o óxido passa a conduzir como zener.' },
  capZenerResistance: { value: 0.5, unit: 'Ω', why: 'Inclinação do modo "tensão constante".' },
  capWithstandDrop: { value: 0.003, unit: '/K', why: 'Nichicon: o calor reduz a isolação do anodo (taxa estimada).' },
  capEsr: { value: 2.1, unit: 'Ω', why: 'tan δ 0,16 a 120 Hz em 100 µF (série de uso geral).' },
  capThermalResistance: { value: 150, unit: 'K/W', why: 'Lata radial 6,3 × 11 mm ao ar livre (estimada a partir de ondulação nominal).' },
  capHeatCapacity: { value: 0.8, unit: 'J/K', why: 'Lata de ~0,7 g com eletrólito.' },
  capGasEfficiency: { value: 0.5, unit: '', why: 'Fração da corrente de fuga excedente que vira H₂ no catodo.' },
  capHeadspace: { value: 0.05, unit: 'mL', why: 'Volume livre dentro de uma lata 6,3 × 11 mm.' },
  capWaterFraction: { value: 0.3, unit: '', why: 'Fração molar de água no eletrólito à base de etilenoglicol.' },
  capVentPressure: { value: 500, unit: 'kPa', why: 'Abertura do vinco da tampa (faixa típica de centenas de kPa; sem valor publicado para esta lata).' },
  capCaseBurst: { value: 2.5, unit: '× ventilação', why: 'Só com a válvula obstruída: a lata/borracha cede.' },
  ledSeriesResistance: { value: 10, unit: 'Ω', why: 'Ajuste para VF 1,9 V a 10 mA e ~2,2 V a 30 mA.' },
  ledIdeality: { value: 2, unit: '', why: 'LED AlGaInP vermelho.' },
  ledHeatCapacity: { value: 0.01, unit: 'J/K', why: 'Constante térmica ~5 s com RthJA 560 K/W.' },
  ledBreakdown: { value: 20, unit: 'V', why: 'Ruptura reversa real fica bem acima dos 5 V garantidos; varia por lote.' },
  ledBondWireFuse: { value: 0.32, unit: 'A', why: 'Preece para fio de ouro de 25 µm (≈ 0,32 A contínuos).' },
  ledEpoxyDamage: { value: 200, unit: '°C', why: 'Epóxi escurece/delamina: brilho cai de forma permanente.' },
  ledDieOpen: { value: 300, unit: '°C', why: 'Junção/solda do chip falha aberta.' },
});
const A = k => ASSUMPTIONS[k].value;

export const DEFAULTS = Object.freeze({ kind: 'capacitor', voltage: 12, resistance: 1000, currentLimitMa: 200, ambient: 25, capacitanceUf: 100, ratedVoltage: 16, ledMode: 'forward', ventBlocked: false, capReversed: false, failureMode: 'open' });

export function validateConfig(input) {
  const c = { ...DEFAULTS, ...input };
  for (const [k, min, max] of [['voltage', 0, 1600], ['resistance', 0.1, 1e6], ['currentLimitMa', 1, 10000], ['ambient', -20, 85], ['capacitanceUf', 1, 10000], ['ratedVoltage', 1, 450]]) {
    if (typeof c[k] !== 'number' || !Number.isFinite(c[k]) || c[k] < min || c[k] > max) throw new RangeError(`Valor inválido: ${k}`);
  }
  if (!['capacitor', 'led'].includes(c.kind) || !['forward', 'reverse'].includes(c.ledMode) || !['open', 'short'].includes(c.failureMode) || typeof c.ventBlocked !== 'boolean' || typeof c.capReversed !== 'boolean') throw new TypeError('Configuração inválida');
  return Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, c[k]]));
}

// Potência contínua admissível do SFR25 com a curva de redução (0,4 W até 70 °C → 0 em 155 °C).
export const resistorLimit = ambient => 0.4 * Math.max(0, Math.min(1, (155 - ambient) / 85));

export function createBench(input = DEFAULTS) {
  const c = validateConfig(input);
  return {
    time: 0, events: [],
    r: { t: c.ambient, state: 'ok', open: false },
    c: { v: 0, t: c.ambient, molH2: 0, state: 'ok', vented: false, failed: null, pressure: 0 },
    d: { t: c.ambient, state: 'ok', fuse: 0, damage: 0, failed: null },
  };
}

function log(sim, component, code, text, source) { sim.events.push({ time: sim.time, component, code, text, source }); }

// ---------- capacitor ----------
const dcl = (c) => Math.max(0.01 * c.capacitanceUf * c.ratedVoltage, 3) * 1e-6; // A, 0,01CV ou 3 µA
function capBreakdown(c, temp) { return c.ratedVoltage * A('capFormationRatio') * Math.max(0.4, 1 - A('capWithstandDrop') * Math.max(0, temp - 25)); }
export function capLeak(c, v, temp) {
  const i0 = dcl(c) * Math.exp(Math.max(0, temp - 25) / 30), vr = c.ratedVoltage, vbd = capBreakdown(c, temp);
  if (v < 0) { const a = -v; return a <= 1 ? -i0 * a : -(i0 + (a - 1) / A('capZenerResistance')); } // catodo resiste ~1 V
  // Contínua em três trechos: ôhmica até vLo, exponencial até a ruptura vbd, zener acima.
  const vLo = Math.min(vr, vbd - 0.5), iLo = i0 * (vLo / vr);
  if (v <= vLo) return i0 * (v / vr);
  if (v <= vbd) return iLo * Math.exp(Math.log(A('capZenerOnset') / iLo) * (v - vLo) / (vbd - vLo));
  return A('capZenerOnset') + (v - vbd) / A('capZenerResistance');
}
function sourceCurrent(c, sim, vLoad) {
  if (sim.r.open) return 0;
  const lim = c.currentLimitMa / 1000;
  return Math.max(-lim, Math.min(lim, (c.voltage - vLoad) / c.resistance));
}
function capPressure(c, cs) {
  const T = cs.t + 273.15, T0 = c.ambient + 273.15, vol = A('capHeadspace') * 1e-6;
  const vap = T => A('capWaterFraction') * ATM * Math.exp(-(40700 / RGAS) * (1 / T - 1 / 373.15));
  const air = ATM * T / T0, h2 = cs.molH2 * RGAS * T / vol / 1000;
  return Math.max(0, air + vap(T) + h2 - ATM - vap(T0)); // kPa manométricos
}
function stepCapacitor(sim, c, dt) {
  const cs = sim.c, C = c.capacitanceUf * 1e-6;
  if (cs.failed === 'open' || cs.failed === 'ruptured') {
    const i = 0; return { i, vLoad: sim.r.open ? 0 : c.voltage, iLeak: 0, pLoad: 0 };
  }
  if (cs.failed === 'short') {
    const i = sourceCurrent(c, sim, 0), p = i * i * 0.05; cs.t += (p - (cs.t - c.ambient) / A('capThermalResistance')) / A('capHeatCapacity') * dt;
    cs.v = i * 0.05; return { i, vLoad: cs.v, iLeak: i, pLoad: p };
  }
  // Implícito: C (v − v0)/dt = I_fonte(v) − I_fuga(v). A função é monótona em v → bisseção.
  const f = v => C * (v - cs.v) / dt - sourceCurrent(c, sim, v) + capLeak(c, v, cs.t);
  let lo = Math.min(cs.v, 0, -c.voltage) - 2, hi = Math.max(cs.v, c.voltage, 0) + 2;
  for (let k = 0; k < 70; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  const v = (lo + hi) / 2, i = sourceCurrent(c, sim, v), iLeak = capLeak(c, v, cs.t), iC = C * (v - cs.v) / dt;
  cs.v = v;
  const p = Math.abs(v * iLeak) + iC * iC * A('capEsr');
  cs.t += (p - (cs.t - c.ambient) / A('capThermalResistance')) / A('capHeatCapacity') * dt;
  const excess = Math.max(0, Math.abs(iLeak) - dcl(c) * 10);
  cs.molH2 += A('capGasEfficiency') * excess / (2 * F) * dt;
  if (!cs.vented) cs.molH2 *= Math.exp(-dt / 600); // permeação lenta pela borracha
  cs.pressure = cs.vented ? 0 : capPressure(c, cs);
  // Estados observáveis
  if (cs.state === 'ok' && v > c.ratedVoltage * 1.001) { cs.state = 'stressed'; log(sim, 'C1', 'cap-over', `Acima de ${c.ratedVoltage} V: a corrente de fuga dispara.`, 'nichicon'); }
  if (cs.state === 'stressed' && v >= capBreakdown(c, cs.t) * 0.995) { cs.state = 'zener'; log(sim, 'C1', 'cap-zener', 'O óxido cedeu: C1 conduz como um zener e esquenta.', 'cde'); }
  if (v < -1.2 && !['zener', 'bulging', 'vented'].includes(cs.state)) { cs.state = 'zener'; log(sim, 'C1', 'cap-reverse', 'Polaridade invertida acima de 1,5 V: conduz e gera gás.', 'cde'); }
  if (!cs.vented && cs.pressure > A('capVentPressure') * 0.4 && cs.state !== 'bulging') { cs.state = 'bulging'; log(sim, 'C1', 'cap-bulge', 'Pressão interna alta: a tampa estufa.', 'nichicon'); }
  const ventAt = A('capVentPressure') * (c.ventBlocked ? A('capCaseBurst') : 1);
  if (!cs.vented && cs.pressure >= ventAt) {
    cs.vented = true; cs.pressure = 0;
    if (c.ventBlocked) { cs.failed = 'ruptured'; cs.state = 'ruptured'; log(sim, 'C1', 'cap-rupture', 'Válvula obstruída: a lata cede de uma vez (estouro).', 'nichicon'); }
    else {
      const short = Math.abs(c.voltage) > 4 * c.ratedVoltage && !sim.r.open;
      cs.failed = short ? 'short' : 'open'; cs.state = 'vented';
      log(sim, 'C1', 'cap-vent', `Válvula abriu: sai vapor de eletrólito e H₂. C1 falhou ${short ? 'em curto (folhas soldadas)' : 'aberto (secou)'}.`, 'nichicon');
    }
  }
  return { i, vLoad: v, iLeak, pLoad: p };
}

// ---------- LED ----------
function ledVoltage(I, temp) {
  if (I <= 0) return 0;
  const nVt = A('ledIdeality') * 0.025693, Is = 0.01 / Math.exp((1.9 - 0.01 * A('ledSeriesResistance')) / nVt);
  return nVt * Math.log(I / Is + 1) + I * A('ledSeriesResistance') - 0.0019 * (temp - 25);
}
function stepLed(sim, c, dt) {
  const d = sim.d, lim = sim.r.open ? 0 : c.currentLimitMa / 1000;
  let i = 0, vLoad = 0;
  if (sim.r.open || d.failed === 'open') { i = 0; vLoad = sim.r.open ? 0 : c.voltage * (c.ledMode === 'reverse' ? -1 : 1); }
  else if (d.failed === 'short') { i = Math.min(lim, c.voltage / c.resistance); vLoad = 0; }
  else if (c.ledMode === 'forward') {
    if (c.voltage > 0) {
      const g = I => c.voltage - I * c.resistance - ledVoltage(I, d.t);
      let lo = 0, hi = Math.min(lim, c.voltage / c.resistance);
      if (g(hi) > 0) lo = hi; else for (let k = 0; k < 70; k++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
      i = lo; vLoad = ledVoltage(i, d.t);
    }
  } else {
    const vbr = A('ledBreakdown');
    if (c.voltage > vbr) { i = Math.min(lim, (c.voltage - vbr) / (c.resistance + 5)); vLoad = -(vbr + i * 5); }
    else { i = 0; vLoad = -c.voltage; }
  }
  const p = Math.abs(i * vLoad);
  d.t += (p - (d.t - c.ambient) / 560) / A('ledHeatCapacity') * dt;
  if (!d.failed) {
    if (d.t > 125 && d.state === 'ok') { d.state = 'hot'; log(sim, 'D1', 'led-hot', 'Junção acima de 125 °C: o brilho começa a degradar.', 'kingbright'); }
    if (d.t > 125) d.damage = Math.min(1, d.damage + dt * (d.t - 125) / 4000);
    if (d.t > A('ledEpoxyDamage') && d.state !== 'dimmed') { d.state = 'dimmed'; d.damage = Math.max(d.damage, 0.6); log(sim, 'D1', 'led-epoxy', 'Epóxi superaquecido: perda permanente de brilho.', 'kingbright'); }
    if (i > A('ledBondWireFuse')) d.fuse += dt * (i / A('ledBondWireFuse')) ** 2;
    if (d.fuse > 1) { d.failed = 'open'; d.state = 'open'; log(sim, 'D1', 'led-wire', 'O fio de ouro fundiu: o LED abriu com um flash.', 'kingbright'); }
    else if (d.t > A('ledDieOpen')) { d.failed = 'open'; d.state = 'open'; log(sim, 'D1', 'led-die', 'O chip superaqueceu e abriu.', 'kingbright'); }
    if (c.ledMode === 'reverse' && c.voltage > 5 && !d.reverseLogged) { d.reverseLogged = true; log(sim, 'D1', 'led-reverse', c.voltage > A('ledBreakdown') ? 'Reverso acima da ruptura: corrente de avalanche aquece o chip.' : 'Reverso acima dos 5 V garantidos: fora da especificação, ainda sem avalanche.', 'kingbright'); }
  }
  const brightness = c.ledMode === 'forward' && !d.failed ? Math.min(1.6, i / 0.02) * (1 - d.damage) * Math.max(0.3, 1 - 0.006 * Math.max(0, d.t - 25)) : 0;
  return { i, vLoad, pLoad: p, brightness };
}

// ---------- resistor ----------
function heatResistor(sim, c, i, dt) {
  const r = sim.r; if (r.open) { r.t += (-(r.t - c.ambient) / 200) / A('resistorHeatCapacity') * dt; return 0; }
  const p = i * i * c.resistance;
  r.t += (p - (r.t - c.ambient) / 200) / A('resistorHeatCapacity') * dt;
  if (r.state === 'ok' && r.t > 155) { r.state = 'hot'; log(sim, 'R1', 'r-hot', 'Filme acima de 155 °C: fora do datasheet.', 'sfr25'); }
  if (r.state === 'hot' && r.t > A('resistorScorch')) { r.state = 'scorched'; log(sim, 'R1', 'r-scorch', 'A laca de R1 escurece.', 'sfr25'); }
  if (r.state === 'scorched' && r.t > A('resistorSmoke')) { r.state = 'smoking'; log(sim, 'R1', 'r-smoke', 'R1 solta fumaça (laca queimando).', 'sfr25'); }
  if (r.t > A('resistorOpen')) { r.open = true; r.state = 'open'; log(sim, 'R1', 'r-open', `R1 queimou e abriu.${c.voltage > 500 ? ' Com mais de 500 V no vão, pode haver arco.' : ''}`, 'sfr25'); }
  return p;
}

export function injectFailure(sim, input, mode) {
  const c = validateConfig(input); mode = mode || c.failureMode;
  if (c.kind === 'capacitor') { if (sim.c.failed) return; sim.c.failed = mode; sim.c.state = mode === 'open' ? 'vented' : 'vented'; log(sim, 'C1', 'inject', `Falha injetada à mão: ${mode === 'open' ? 'aberto' : 'curto'}.`, 'nichicon'); }
  else { if (sim.d.failed) return; sim.d.failed = mode; sim.d.state = mode; log(sim, 'D1', 'inject', `Falha injetada à mão: ${mode === 'open' ? 'aberto' : 'curto'}.`, 'kingbright'); }
}

// Avança dt segundos em subpassos de no máximo 5 ms e devolve as leituras.
export function stepBench(sim, input, dt = 0, maxStep = 0.005) {
  const valid = validateConfig(input);
  const c = valid.kind === 'capacitor' && valid.capReversed ? { ...valid, voltage: -valid.voltage } : valid;
  if (!Number.isFinite(dt) || dt < 0 || dt > 3600) throw new RangeError('Passo inválido');
  let left = dt, out = null;
  do {
    const h = Math.min(left, maxStep) || 1e-6;
    const load = c.kind === 'capacitor' ? stepCapacitor(sim, c, h) : stepLed(sim, c, h);
    const pR = heatResistor(sim, c, load.i, left > 0 ? h : 0);
    if (left > 0) sim.time += h;
    out = { load, pR };
    left -= h;
  } while (left > 1e-12);
  return readings(sim, c, out.load);
}
function readings(sim, c, load) {
  const i = load.i, rOpen = sim.r.open;
  const resistorVoltage = rOpen ? c.voltage - (load.vLoad || 0) : i * c.resistance;
  const sourceVoltage = rOpen ? c.voltage : (c.voltage >= 0 ? Math.min(c.voltage, i * c.resistance + load.vLoad) : Math.max(c.voltage, i * c.resistance + load.vLoad));
  const cap = c.kind === 'capacitor', C = c.capacitanceUf * 1e-6;
  const issues = [];
  const pR = rOpen ? 0 : i * i * c.resistance;
  if (pR > resistorLimit(c.ambient) + 1e-12) issues.push({ component: 'R1', code: 'resistor-power', observed: pR, limit: resistorLimit(c.ambient), unit: 'W', source: 'sfr25', message: `R1 dissipa ${(pR / 0.4).toFixed(pR >= 4 ? 0 : 1)}× a potência nominal.` });
  if (cap && load.vLoad > c.ratedVoltage) issues.push({ component: 'C1', code: 'capacitor-voltage', observed: load.vLoad, limit: c.ratedVoltage, unit: 'V', source: 'nichicon', message: 'Acima da tensão nominal: fuga alta, aquecimento e gás.' });
  if (!cap && c.ledMode === 'forward' && i > 0.03) issues.push({ component: 'D1', code: 'led-current', observed: i, limit: 0.03, unit: 'A', source: 'kingbright', message: 'Corrente acima de 30 mA DC.' });
  if (!cap && load.pLoad > 0.075) issues.push({ component: 'D1', code: 'led-power', observed: load.pLoad, limit: 0.075, unit: 'W', source: 'kingbright', message: 'Dissipação acima de 75 mW.' });
  if (!cap && c.ledMode === 'reverse' && c.voltage > 5) issues.push({ component: 'D1', code: 'led-reverse', observed: c.voltage, limit: 5, unit: 'V', source: 'kingbright', message: 'Tensão reversa acima de 5 V.' });
  return {
    time: sim.time, current: i, terminalVoltage: cap ? (sim.c.failed === 'open' || sim.c.failed === 'ruptured' ? (rOpen ? 0 : c.voltage) : load.vLoad) : load.vLoad,
    sourceVoltage, resistorVoltage, resistorPower: pR, resistorLimit: resistorLimit(c.ambient), resistorTemperature: sim.r.t,
    limited: !rOpen && i >= c.currentLimitMa / 1000 - 1e-9, issues,
    energy: cap && !sim.c.failed ? 0.5 * C * sim.c.v ** 2 : 0, voltageRatio: cap ? load.vLoad / c.ratedVoltage : 0,
    leakage: cap ? load.iLeak : 0, capPower: cap ? load.pLoad : 0, capTemperature: sim.c.t, pressureKPa: sim.c.pressure,
    ledPower: cap ? 0 : load.pLoad, ledTemperature: sim.d.t, brightness: cap ? 0 : load.brightness,
    states: { resistor: sim.r.state, capacitor: sim.c.state, led: sim.d.state },
    fault: cap ? sim.c.failed : sim.d.failed, resistorOpen: rOpen, events: sim.events,
  };
}

// Cenários: o desfecho sai da física, não de um gatilho.
export const SCENARIOS = Object.freeze([
  { id: 'nominal', label: 'Dentro dos limites', subtitle: '12 V · carga RC', speed: 1, config: { ...DEFAULTS } },
  { id: 'overvoltage', label: 'Sobretensão 2×', subtitle: '32 V num capacitor de 16 V', speed: 60, config: { ...DEFAULTS, voltage: 32 } },
  { id: 'extreme', label: '100× a tensão', subtitle: '1.600 V · fonte limitada a 200 mA', speed: 1, config: { ...DEFAULTS, voltage: 1600 } },
  { id: 'direct', label: 'Direto na fonte forte', subtitle: '30 V · 0,1 Ω · 3 A', speed: 1, config: { ...DEFAULTS, voltage: 30, resistance: 0.1, currentLimitMa: 3000 } },
  { id: 'reverse-cap', label: 'Capacitor invertido', subtitle: '12 V ao contrário · 1 Ω · 1 A', speed: 1, config: { ...DEFAULTS, voltage: 12, resistance: 1, currentLimitMa: 1000, capReversed: true } },
  { id: 'blocked', label: 'Válvula obstruída', subtitle: '30 V · 3 A · vent colado', speed: 1, config: { ...DEFAULTS, voltage: 30, resistance: 0.1, currentLimitMa: 3000, ventBlocked: true } },
  { id: 'led-nominal', label: 'LED protegido', subtitle: '5 V · 330 Ω', speed: 1, config: { ...DEFAULTS, kind: 'led', voltage: 5, resistance: 330 } },
  { id: 'led-overload', label: 'LED sobrecarregado', subtitle: '12 V · 100 Ω', speed: 10, config: { ...DEFAULTS, kind: 'led', voltage: 12, resistance: 100 } },
  { id: 'led-direct', label: 'LED sem resistor', subtitle: '5 V · 1 Ω · 1 A', speed: 1, config: { ...DEFAULTS, kind: 'led', voltage: 5, resistance: 1, currentLimitMa: 1000 } },
  { id: 'led-reverse', label: 'LED invertido', subtitle: '30 V reverso · 330 Ω', speed: 10, config: { ...DEFAULTS, kind: 'led', voltage: 30, resistance: 330, ledMode: 'reverse' } },
]);
