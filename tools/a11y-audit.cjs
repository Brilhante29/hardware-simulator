// Auditoria de acessibilidade (axe-core) de todas as páginas, em desktop e celular, e checagem de rolagem horizontal.
// Uso: npm i --no-save axe-core && node tools/studio-server.mjs --port 8090 & node tools/a11y-audit.cjs [http://localhost:8090]
const { chromium, devices } = require('playwright'); const fs = require('fs');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [process.cwd(), __dirname] }), 'utf8');
const base = (process.argv[2] || 'http://localhost:8090').replace(/\/$/, '');
const pages = ['index.html', 'studio.html', 'editor.html', 'boot.html', 'pcb.html?example=relogio-placa', 'watch.html', 'avc.html', 'lab/sn74hc595.html'];
(async () => {
  const b = await chromium.launch(); let total = 0;
  for (const [label, ctx] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['celular', devices['iPhone 13']]]) {
    const c = await b.newContext(ctx);
    for (const pg of pages) {
      const p = await c.newPage(); await p.goto(`${base}/${pg}`); await p.waitForTimeout(3500);
      await p.addScriptTag({ content: axe });
      const r = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) })));
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      total += r.length; console.log(`\n[${label}] ${pg}: ${r.length} regras violadas${sw > 0 ? `, rolagem horizontal de ${sw}px` : ''}`);
      for (const v of r) console.log(`  ${v.impact} ${v.id} ×${v.n}: ${v.ex.join(' | ')}`.slice(0, 400));
      await p.close();
    }
  }
  console.log('\nTOTAL', total); await b.close(); if (total) process.exitCode = 1;
})();
