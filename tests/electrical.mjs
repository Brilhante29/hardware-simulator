// 16 grupos elétricos/térmicos contra equações e números de datasheet (src/engine/physics.mjs).
import { DEFAULTS, SCENARIOS, createBench, stepBench, injectFailure, resistorLimit, validateConfig, capLeak } from '../src/engine/physics.mjs';

const scenario = id => SCENARIOS.find(s => s.id === id).config;
function runFor(config, seconds, step = 0.01) { const sim = createBench(config); let m; const n = Math.round(seconds / step); for (let i = 0; i < n; i++) m = stepBench(sim, config, step); return { sim, m }; }
const first = (sim, code) => sim.events.find(e => e.code === code);

export function runElectricalTests() {
  const results = []; const test = (name, source, fn) => { try { fn(); results.push({ name, source, pass: true }); } catch (e) { results.push({ name, source, pass: false, error: e.message }); } };
  const near = (a, b, rel, label = '') => { if (Math.abs(a - b) > Math.abs(b) * rel) throw Error(`${label}${a} ≠ ${b} (±${rel * 100}%)`); };
  const ok = (x, msg = 'Condição não atendida') => { if (!x) throw Error(msg); };

  test('RC: 63,2 % de 12 V após τ = RC = 0,1 s', 'Lei RC', () => near(runFor(DEFAULTS, 0.1, 0.001).m.terminalVoltage, 12 * (1 - Math.exp(-1)), 0.01));
  test('RC: passo de 1 ms e de 5 ms concordam', 'Convergência numérica', () => near(runFor(DEFAULTS, 0.2, 0.005).m.terminalVoltage, runFor(DEFAULTS, 0.2, 0.001).m.terminalVoltage, 0.01));
  test('Energia: 100 µF a 12 V armazena 7,2 mJ', 'E = CV²/2', () => near(runFor(DEFAULTS, 2).m.energy, 0.0072, 0.01));
  test('A fonte nunca passa do limite de corrente', 'Fonte CV/CC', () => { const sim = createBench(scenario('extreme')); for (let i = 0; i < 300; i++) ok(Math.abs(stepBench(sim, scenario('extreme'), 0.01).current) <= 0.2 + 1e-9); });
  test('12 V em 16 V: nada esquenta nem falha em 60 s', 'Nichicon §2-3', () => { const { sim, m } = runFor(DEFAULTS, 60, 0.05); ok(!sim.events.length, 'eventos inesperados'); ok(m.capTemperature < 26 && m.resistorTemperature < 26); });
  test('Fuga na nominal = 0,01·C·V (16 µA) e sem saltos', 'Nichicon / contínua', () => {
    const c = validateConfig(DEFAULTS); near(capLeak(c, 16, 25), 16e-6, 0.01);
    let prev = 0; for (let v = 0; v <= 40; v += 0.01) { const i = capLeak(c, v, 25); ok(i >= prev - 1e-12, 'fuga não monótona'); ok(i - prev < 0.05, `salto em ${v.toFixed(2)} V`); prev = i; }
  });
  test('2× a nominal: C1 trava perto de 1,35 × VR e conduz como zener', 'CDE: modo tensão constante', () => { const { sim, m } = runFor(scenario('overvoltage'), 2); near(m.terminalVoltage, 21.6, 0.05); ok(first(sim, 'cap-zener')); });
  test('2× a nominal: a válvula abre em minutos, não em segundos', 'CDE: H₂ e pressão', () => { const { sim } = runFor(scenario('overvoltage'), 1800, 0.25); const e = first(sim, 'cap-vent'); ok(e, 'não ventilou'); ok(e.time > 60 && e.time < 1800, `ventilou em ${e.time}`); });
  test('100× via 1 kΩ: R1 dissipa 40 W e queima antes de C1 ventilar', 'Vishay SFR25 + Ohm', () => {
    const sim = createBench(scenario('extreme')); const m = stepBench(sim, scenario('extreme'), 0.05); near(m.resistorPower, 40, 0.01);
    for (let i = 0; i < 600; i++) stepBench(sim, scenario('extreme'), 0.01);
    const open = first(sim, 'r-open'); ok(open && open.time < 6, 'R1 não abriu'); ok(!first(sim, 'cap-vent') || first(sim, 'cap-vent').time > open.time);
  });
  test('SFR25 aguenta o ensaio de sobrecarga: 6,25 × Pn por 5 s', 'Vishay SFR25 §8.1', () => {
    const R = 1000, I = Math.sqrt(6.25 * 0.4 / R), cfg = { ...DEFAULTS, kind: 'led', voltage: 200, resistance: R, currentLimitMa: I * 1000, ledMode: 'forward' };
    const { sim } = runFor(cfg, 5); ok(!sim.r.open && !['smoking', 'open'].includes(sim.r.state), `R1 ${sim.r.state}`);
  });
  test('Fonte forte 30 V / 3 A: válvula abre em segundos, sem estilhaço', 'Nichicon: ensaio da válvula', () => { const { sim, m } = runFor(scenario('direct'), 10); const e = first(sim, 'cap-vent'); ok(e && e.time < 5); ok(m.fault !== 'ruptured'); });
  test('Só com a válvula obstruída a lata rompe', 'Nichicon: válvula', () => { const { sim } = runFor(scenario('blocked'), 10); ok(first(sim, 'cap-rupture')); ok(!first(sim, 'cap-vent')); });
  test('Capacitor invertido a 1 A: ventila em segundos', 'Nichicon JIS C5101-1 4.28.2', () => { const { sim } = runFor(scenario('reverse-cap'), 15); const e = first(sim, 'cap-vent'); ok(e && e.time < 10); });
  test('LED 5 V / 330 Ω: ~9,4 mA, VF ≈ 1,9 V e balanço de potência', 'Kingbright WP7113ID', () => { const { m } = runFor(scenario('led-nominal'), 0.05); near(m.current, 0.0094, 0.03); near(m.terminalVoltage, 1.89, 0.03); near(m.current * 5, m.resistorPower + m.ledPower + 0, 0.01); });
  test('LED a 30 mA fica abaixo de 125 °C; sem resistor ele morre', 'Kingbright: IF, Tj, RthJA', () => {
    const at30 = runFor({ ...DEFAULTS, kind: 'led', voltage: 9, resistance: 230 }, 60, 0.05); near(at30.m.current, 0.03, 0.05); ok(at30.m.ledTemperature < 125);
    const direct = runFor(scenario('led-direct'), 10); ok(direct.m.fault === 'open', 'não falhou');
  });
  test('Entrada inválida é rejeitada; falha injetada persiste', 'Contrato do modelo', () => {
    for (const resistance of [0, -1, NaN, Infinity, '100']) { let rejected = false; try { validateConfig({ resistance }); } catch { rejected = true; } ok(rejected); }
    near(resistorLimit(70), 0.4, 1e-9); near(resistorLimit(112.5), 0.2, 1e-9); ok(resistorLimit(155) === 0);
    const sim = createBench(DEFAULTS); injectFailure(sim, DEFAULTS, 'short'); stepBench(sim, DEFAULTS, 1); ok(sim.c.failed === 'short'); ok(!createBench(DEFAULTS).c.failed);
  });
  return results;
}
