// Solver de corrente contínua do editor: análise nodal com resistores, fontes com resistência interna e diodos/LEDs
// por modelo linear por partes (Vf + resistência série). Fios e contatos fechados viram curtos; o resto é condutância.
// Serve para o que o firmware lê (níveis lógicos e analogRead) e para o que o circuito mostra (corrente em LEDs).
(function (root) {
  // Valor de resistor escrito pela pessoa: '220 Ω', '10k', '4,7 kΩ', '1M', '1R5'.
  function ohms(text, fallback = 220) {
    const t = String(text ?? '').trim().replace(',', '.').replace(/Ω|ohms?/gi, '').trim();
    const m = t.match(/^(\d*\.?\d+)\s*([rRkKmM]?)(\d*)$/); if (!m) return fallback;
    const mult = { '': 1, r: 1, R: 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]];
    const v = parseFloat(m[1] + (m[3] ? '.' + m[3] : '')) * mult; return v > 0 ? v : fallback;
  }
  // Capacitância escrita pela pessoa: '100 µF', '100uF', '10n', '4,7 µF', '1mF'.
  function farads(text, fallback = 100e-6) {
    const m = String(text ?? '').trim().replace(',', '.').match(/^(\d*\.?\d+)\s*([pnuµm]?)\s*F?$/i); if (!m) return fallback;
    const v = parseFloat(m[1]) * { '': 1, p: 1e-12, n: 1e-9, u: 1e-6, U: 1e-6, 'µ': 1e-6, m: 1e-3, M: 1e-3 }[m[2]]; return v > 0 ? v : fallback;
  }
  // Fotoresistor GL5528 (datasheet): 8–20 kΩ a 10 lux, γ ≈ 0,7 e ≥ 1 MΩ no escuro.
  function ldrOhms(lux) { return Math.min(1e6, 15e3 * Math.pow(Math.max(Number(lux) || 0, 0.01) / 10, -0.7)); }
  // Tensão direta típica a 20 mA (5 mm): vermelho/amarelo/laranja ~2,0 V; verde InGaN, azul e branco ~3,0 V.
  function ledVf(color) {
    const c = String(color || '').toLowerCase(), hex = c.match(/^#?([0-9a-f]{6})$/);
    if (hex) { const n = parseInt(hex[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return b > r && b > 100 ? 3.0 : g > r * 1.3 ? 2.9 : 1.9; }
    return /blue|azul|white|branc|green|verde/.test(c) ? 3.0 : 1.9;
  }

  // circuit: { shorts: [[a, b]], resistors: [[a, b, ohms]], sources: [{ node, volts, r }], diodes: [{ a, k, vf, rs }],
  //   currents: [{ a, b, amps }] (fonte de corrente que leva `amps` de a para b, ex.: coletor de NPN na região ativa),
  //   capacitors: [{ a, b, farads, v0, dt }] (passo de Euler implícito: C/dt em série com a tensão anterior v0; sem dt, aberto) }
  // r = 0 é fonte ideal (fixa o nó). Devolve volts(nó) (undefined se o nó flutua), corrente de cada diodo (A),
  // corrente de cada fonte (A, saindo da fonte) e os conflitos (fontes ideais diferentes no mesmo nó: curto-circuito).
  function solve({ shorts = [], resistors = [], sources = [], diodes = [], currents = [], capacitors = [] }) {
    const parent = new Map(), find = x => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); let y = x; while (parent.get(y) !== r) { const n = parent.get(y); parent.set(y, r); y = n; } return r; };
    for (const [a, b] of shorts) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
    const fixed = new Map(), conflicts = [], branches = [];
    sources.forEach((s, i) => {
      if (s.r > 0) { const hidden = `__src${i}`; fixed.set(find(hidden), s.volts); branches.push({ a: find(hidden), b: find(s.node), g: 1 / s.r, src: i }); return; }
      const g = find(s.node); if (fixed.has(g) && Math.abs(fixed.get(g) - s.volts) > 1e-9) { conflicts.push({ node: s.node, volts: [fixed.get(g), s.volts] }); fixed.set(g, Math.min(fixed.get(g), s.volts)); } else fixed.set(g, s.volts);
    });
    for (const [a, b, r] of resistors) branches.push({ a: find(a), b: find(b), g: 1 / Math.max(r, 1e-3) });
    for (const c of capacitors) if (c.dt > 0) branches.push({ a: find(c.a), b: find(c.b), g: c.farads / c.dt, vf: c.v0 || 0 });
    const on = diodes.map(() => false);
    let volts = new Map();
    for (let iter = 0; iter < 30; iter++) {
      // Diodo desligado ainda vaza (~nA): 1 GΩ define o nó entre dois LEDs em série, como no componente real.
      const all = branches.concat(diodes.map((d, i) => on[i] ? { a: find(d.a), b: find(d.k), g: 1 / d.rs, vf: d.vf } : { a: find(d.a), b: find(d.k), g: 1e-9 }));
      // Só entram na conta os nós ligados (por resistor ou diodo conduzindo) a algum nó fixo; os outros flutuam.
      const adj = new Map(); for (const br of all) { if (br.a === br.b) continue; (adj.get(br.a) || adj.set(br.a, []).get(br.a)).push(br.b); (adj.get(br.b) || adj.set(br.b, []).get(br.b)).push(br.a); }
      const reach = new Set(fixed.keys()), queue = [...fixed.keys()]; while (queue.length) for (const n of adj.get(queue.pop()) || []) if (!reach.has(n)) { reach.add(n); queue.push(n); }
      const unknown = [...reach].filter(n => !fixed.has(n)), index = new Map(unknown.map((n, i) => [n, i])), N = unknown.length;
      const G = Array.from({ length: N }, () => new Float64Array(N)), I = new Float64Array(N);
      const vOf = n => fixed.get(n);
      for (const br of all) {
        if (br.a === br.b) continue; const ia = index.get(br.a), ib = index.get(br.b), off = br.vf || 0; // corrente a→b = g·(Va − Vb − vf)
        if (ia !== undefined) { G[ia][ia] += br.g; I[ia] += br.g * off; if (ib !== undefined) G[ia][ib] -= br.g; else if (fixed.has(br.b)) I[ia] += br.g * vOf(br.b); }
        if (ib !== undefined) { G[ib][ib] += br.g; I[ib] -= br.g * off; if (ia !== undefined) G[ib][ia] -= br.g; else if (fixed.has(br.a)) I[ib] += br.g * vOf(br.a); }
      }
      for (const c of currents) { const ia = index.get(find(c.a)), ib = index.get(find(c.b)); if (ia !== undefined) I[ia] -= c.amps; if (ib !== undefined) I[ib] += c.amps; }
      const x = gauss(G, I);
      volts = new Map(fixed); unknown.forEach((n, i) => volts.set(n, x[i]));
      // Diodo liga quando a tensão passa de Vf e desliga quando a corrente inverteria.
      let changed = false;
      diodes.forEach((d, i) => {
        const va = volts.get(find(d.a)), vk = volts.get(find(d.k));
        const want = va !== undefined && vk !== undefined && (on[i] ? (va - vk - d.vf) / d.rs > -1e-9 : va - vk > d.vf + 1e-6);
        if (want !== on[i]) { on[i] = want; changed = true; }
      });
      if (!changed) break;
    }
    const v = node => volts.get(find(node));
    const diodeCurrent = diodes.map((d, i) => on[i] ? Math.max(0, (v(d.a) - v(d.k) - d.vf) / d.rs) : 0);
    const sourceCurrent = sources.map((s, i) => { if (!(s.r > 0)) return null; const vn = v(s.node); return vn === undefined ? 0 : (s.volts - vn) / s.r; });
    // Tensão nova de cada capacitor (fica a anterior se um lado flutua: a carga não tem para onde ir).
    const capVolts = capacitors.map(c => { const a = v(c.a), b = v(c.b); return a === undefined || b === undefined || !(c.dt > 0) ? (c.v0 || 0) : a - b; });
    return { volts: v, diodeCurrent, sourceCurrent, capVolts, conflicts, find };
  }
  function gauss(A, b) {
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-15) continue; [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((row, i) => (Math.abs(row[i]) < 1e-15 ? 0 : row[n] / row[i]));
  }
  // Leitura digital do ATmega a 5 V: VIH = 0,6·VCC = 3,0 V e VIL = 0,3·VCC = 1,5 V; entre os dois (ou flutuando) é indefinido.
  function logicLevel(volts) { return volts === undefined ? null : volts >= 3.0 ? 1 : volts <= 1.5 ? 0 : null; }

  const api = { ohms, farads, ldrOhms, ledVf, solve, logicLevel, PIN_R: 25, PULLUP_R: 35e3, HFE: 100 };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Circuit = api;
})(typeof window !== 'undefined' ? window : globalThis);
