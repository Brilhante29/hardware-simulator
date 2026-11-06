// Interpretador de um subconjunto de sketches Arduino para o editor livre.
// Entende: comentários, #define, constantes e variáveis inteiras, LED_BUILTIN, setup() executado uma vez,
// loop() repetido, for com contador inteiro, blocos, digitalWrite, analogWrite (como liga/desliga) e delay.
// Não compila C++. Chamadas desconhecidas são ignoradas e listadas em `warnings`.
(function (root) {
  const BUILTIN = { HIGH: 1, LOW: 0, true: 1, false: 0, LED_BUILTIN: 13, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 };
  const TYPES = '(?:const\\s+)?(?:unsigned\\s+)?(?:int|byte|uint8_t|uint16_t|int16_t|long|short|bool|boolean|char|size_t)';
  const MAX_OPS = 20000, MAX_ITER = 2000;

  function strip(code) {
    return String(code || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");
  }
  function matchBrace(src, open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) return i; }
    return -1;
  }
  function body(src, name) {
    const m = new RegExp(`void\\s+${name}\\s*\\(\\s*(?:void)?\\s*\\)\\s*\\{`).exec(src);
    if (!m) return null;
    const open = m.index + m[0].length - 1, close = matchBrace(src, open);
    return close < 0 ? null : { text: src.slice(open + 1, close), start: m.index, end: close + 1 };
  }

  function makeEval(scopeChain, warn) {
    return function evaluate(expr) {
      const text = String(expr).trim();
      if (!text) return NaN;
      const replaced = text.replace(/[A-Za-z_]\w*/g, id => {
        for (const scope of scopeChain()) if (Object.prototype.hasOwnProperty.call(scope, id)) return '(' + scope[id] + ')';
        if (Object.prototype.hasOwnProperty.call(BUILTIN, id)) return String(BUILTIN[id]);
        warn(`Nome desconhecido: ${id}`); return 'NaN';
      });
      if (!/^[\d\s+\-*/%()<>=!&|.NaN]*$/.test(replaced)) { warn(`Expressão não suportada: ${text}`); return NaN; }
      try { const v = Function(`"use strict";return (${replaced});`)(); return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v); }
      catch { warn(`Expressão não suportada: ${text}`); return NaN; }
    };
  }

  // Divide um bloco em instruções de topo: "x;", "{...}", "for(...) stmt", "if(...) stmt".
  function statements(src) {
    const out = []; let i = 0;
    const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    function readParen() { const s = i; let d = 0; for (; i < src.length; i++) { if (src[i] === '(') d++; else if (src[i] === ')' && --d === 0) { i++; return src.slice(s + 1, i - 1); } } return src.slice(s + 1); }
    function readStmt() {
      skipWs(); if (i >= src.length) return null;
      if (src[i] === '{') { const close = matchBrace(src, i); const inner = src.slice(i + 1, close < 0 ? src.length : close); i = close < 0 ? src.length : close + 1; return { kind: 'block', body: inner }; }
      const kw = /^(for|while|if)\b/.exec(src.slice(i));
      if (kw) { i += kw[1].length; skipWs(); const head = src[i] === '(' ? readParen() : ''; const inner = readStmt();
        let alt = null; if (kw[1] === 'if') { skipWs(); if (/^else\b/.test(src.slice(i))) { i += 4; alt = readStmt(); } }
        return { kind: kw[1], head, body: inner, alt }; }
      const s = i; let d = 0;
      for (; i < src.length; i++) { const c = src[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === ';' && d === 0) { i++; break; } }
      const text = src.slice(s, i).replace(/;$/, '').trim();
      return { kind: 'simple', text };
    }
    while (i < src.length) { const st = readStmt(); if (!st) break; out.push(st); }
    return out;
  }

  function parse(code) {
    const warnings = new Set(); const warn = w => warnings.add(w);
    const src = strip(code);
    const globals = {};
    let scopes = [globals];
    const evaluate = makeEval(() => scopes.slice().reverse(), warn);

    src.replace(/^[ \t]*#define\s+([A-Za-z_]\w*)\s+([^\n]+)$/gm, (_, name, value) => { const v = evaluate(value); if (Number.isFinite(v)) globals[name] = v; return ''; });
    const setupB = body(src, 'setup'), loopB = body(src, 'loop');
    let outside = src;
    [loopB, setupB].filter(Boolean).sort((a, b) => b.start - a.start).forEach(b => { outside = outside.slice(0, b.start) + outside.slice(b.end); });
    outside = outside.replace(/^[ \t]*#[^\n]*$/gm, '');
    const declRe = new RegExp(`${TYPES}\\s+([A-Za-z_]\\w*)\\s*(?:\\[[^\\]]*\\])?\\s*=\\s*([^;{]+);`, 'g');
    let m; while ((m = declRe.exec(outside))) { const v = evaluate(m[2]); if (Number.isFinite(v)) globals[m[1]] = v; }

    function run(block, ops) {
      for (const st of statements(block)) {
        if (ops.length > MAX_OPS) { warn('Sketch longo demais: execução interrompida'); return; }
        if (st.kind === 'block') { scopes.push({}); run(st.body, ops); scopes.pop(); continue; }
        if (st.kind === 'for') {
          const [init = '', cond = '', step = ''] = st.head.split(';');
          scopes.push({}); exec(init, ops, true);
          let n = 0;
          while (cond.trim() === '' ? false : evaluate(cond)) {
            if (++n > MAX_ITER) { warn('for com repetições demais: interrompido'); break; }
            scopes.push({}); run(st.body ? (st.body.kind === 'block' ? st.body.body : stmtText(st.body)) : '', ops); scopes.pop();
            exec(step, ops, false);
          }
          scopes.pop(); continue;
        }
        if (st.kind === 'if') {
          const c = evaluate(st.head);
          if (Number.isNaN(c)) { warn('if com condição não suportada: bloco ignorado'); continue; }
          const branch = c ? st.body : st.alt;
          if (branch) { scopes.push({}); run(branch.kind === 'block' ? branch.body : stmtText(branch), ops); scopes.pop(); }
          continue;
        }
        if (st.kind === 'while') { warn('while ainda não é interpretado: bloco ignorado'); continue; }
        exec(st.text, ops, false);
      }
    }
    const stmtText = st => st.kind === 'simple' ? st.text + ';' : st.kind === 'block' ? st.body : '';
    function assign(name, value) {
      for (let k = scopes.length - 1; k >= 0; k--) if (Object.prototype.hasOwnProperty.call(scopes[k], name)) { scopes[k][name] = value; return; }
      scopes[scopes.length - 1][name] = value;
    }
    function exec(text, ops, declare) {
      text = String(text || '').trim(); if (!text) return;
      let mm;
      if ((mm = new RegExp(`^${TYPES}\\s+([A-Za-z_]\\w*)\\s*=\\s*(.+)$`).exec(text))) { scopes[scopes.length - 1][mm[1]] = evaluate(mm[2]); return; }
      if ((mm = /^([A-Za-z_]\w*)\s*(\+\+|--)$/.exec(text)) || (mm = /^(\+\+|--)\s*([A-Za-z_]\w*)$/.exec(text))) { const name = mm[1] === '++' || mm[1] === '--' ? mm[2] : mm[1]; const op = mm[1] === '++' || mm[2] === '++' ? 1 : -1; assign(name, evaluate(name) + op); return; }
      if ((mm = /^([A-Za-z_]\w*)\s*([+\-*/])=\s*(.+)$/.exec(text))) { assign(mm[1], evaluate(`${evaluate(mm[1])}${mm[2]}(${evaluate(mm[3])})`)); return; }
      if ((mm = /^([A-Za-z_]\w*)\s*=\s*([^=].*)$/.exec(text))) { assign(mm[1], evaluate(mm[2])); return; }
      if ((mm = /^([A-Za-z_][\w.]*)\s*\(([\s\S]*)\)$/.exec(text))) {
        const fn = mm[1], args = splitArgs(mm[2]);
        if (fn === 'digitalWrite' || fn === 'analogWrite') {
          const pin = evaluate(args[0]), val = evaluate(args[1]);
          if (fn === 'analogWrite') warn('analogWrite é aproximado: valor > 0 liga, 0 desliga');
          if (!Number.isInteger(pin) || pin < 0 || pin > 13) { warn(`Pino fora de D0–D13 ignorado: ${args[0]}`); return; }
          if (!Number.isFinite(val)) return;
          ops.push({ t: 'w', pin, level: val > 0 ? 1 : 0 }); return;
        }
        if (fn === 'delay') { const ms = evaluate(args[0]); if (Number.isFinite(ms) && ms >= 0) ops.push({ t: 'd', ms }); return; }
        if (fn === 'pinMode' || fn === 'delayMicroseconds') return;
        if (fn.startsWith('Serial')) { warn('Serial é ignorado na simulação'); return; }
        warn(`Ignorado: ${fn}()`); return;
      }
      warn(`Instrução não suportada: ${text.slice(0, 40)}`);
    }
    function splitArgs(s) { const out = []; let d = 0, cur = ''; for (const c of s) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0) { out.push(cur); cur = ''; } else cur += c; } if (cur.trim()) out.push(cur); return out; }

    const setup = [], loop = [];
    if (setupB || loopB) {
      if (setupB) { scopes = [globals, {}]; run(setupB.text, setup); }
      if (loopB) { scopes = [globals, {}]; run(loopB.text, loop); }
      else warn('Sem loop(): só setup() é executado');
    } else {
      scopes = [globals, {}]; run(outside, loop);
    }
    const loopDelay = loop.filter(o => o.t === 'd').reduce((a, o) => a + o.ms, 0);
    if (loop.some(o => o.t === 'w') && loopDelay === 0) warn('loop() sem delay: a simulação usa 250 ms por volta para ser visível');
    const writes = setup.concat(loop).filter(o => o.t === 'w').length;
    return { setup, loop, warnings: [...warnings], writes, loopDelay };
  }

  // Agrupa operações em passos: aplica escritas até o próximo delay.
  function timeline(ops) {
    const steps = []; let writes = [];
    for (const o of ops) { if (o.t === 'w') writes.push(o); else { steps.push({ writes, ms: o.ms }); writes = []; } }
    if (writes.length) steps.push({ writes, ms: 0 });
    return steps;
  }

  const api = { parse, timeline };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Sketch = api;
})(typeof window !== 'undefined' ? window : globalThis);
