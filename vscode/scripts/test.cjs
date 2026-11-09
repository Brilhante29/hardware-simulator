// Teste da extensão sem abrir o VS Code: um "vscode" de mentira registra os comandos, o comando abre o painel e o
// servidor real compila de verdade o relógio de exemplo (pio run) numa cópia temporária.
const Module = require('module'), path = require('path'), fs = require('fs'), os = require('os');
const repo = path.join(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-vscode-'));
fs.cpSync(path.join(repo, 'examples/firmware/relogio/platformio.ini'), path.join(tmp, 'platformio.ini'));
fs.cpSync(path.join(repo, 'examples/firmware/relogio/src'), path.join(tmp, 'src'), { recursive: true });

const handlers = {}, panels = [], errors = [];
const vscodeMock = {
  ViewColumn: { Beside: -2 },
  Uri: { parse: s => ({ toString: () => s }) },
  env: { asExternalUri: async u => u },
  commands: { registerCommand: (id, fn) => { handlers[id] = fn; return { dispose() {} }; } },
  workspace: { workspaceFolders: [{ uri: { fsPath: tmp } }], getConfiguration: () => ({ get: () => '' }) },
  window: {
    activeTextEditor: { document: { uri: { scheme: 'file', fsPath: path.join(tmp, 'src', 'main.cpp') } } },
    showErrorMessage: m => errors.push(m), createOutputChannel: () => ({ append() {}, appendLine() {} }),
    createWebviewPanel: (id, title) => { const p = { title, webview: { html: '' }, onDidDispose() {}, reveal() {}, dispose() {} }; panels.push(p); return p; },
  },
};
const load = Module._load; Module._load = function (req, ...rest) { return req === 'vscode' ? vscodeMock : load.call(this, req, ...rest); };

(async () => {
  const ext = require('../extension.js'), context = { extensionPath: path.join(__dirname, '..'), subscriptions: [] };
  const fail = m => { console.error('FAIL', m); process.exitCode = 1; };
  ext.activate(context);
  if (!handlers['hardwareStudio.open'] || !handlers['hardwareStudio.rebuild']) return fail('comandos não registrados');
  await handlers['hardwareStudio.open']();
  const s = ext._session(), url = panels[0]?.webview.html.match(/src="([^"]+)"/)?.[1];
  if (!s || !url || !url.includes(`127.0.0.1:${s.server.port}/editor.html`)) return fail('painel sem o Studio: ' + url);
  console.log('PASS painel aberto com', url);
  const page = await fetch(url); if (page.status !== 200 || !(await page.text()).includes('app.js')) return fail('editor.html não servido');
  console.log('PASS editor.html servido pelo servidor da extensão');
  let last = null; for (let i = 0; i < 600 && !last; i++) { await new Promise(r => setTimeout(r, 500)); last = (await (await fetch(`http://127.0.0.1:${s.server.port}/api/project`)).json()).last; }
  if (!last?.ok || !last.runnable || last.env !== 'nano' || !last.hex?.startsWith(':')) return fail('compilação: ' + JSON.stringify({ ok: last?.ok, err: last?.error }));
  console.log(`PASS projeto compilado ao abrir: ${last.env} (${last.mcu}), ${last.size} bytes`);
  fs.writeFileSync(path.join(tmp, 'src', 'main.cpp'), fs.readFileSync(path.join(tmp, 'src', 'main.cpp'), 'utf8').replace('relogio pronto', 'relogio salvo'));
  let next = null; for (let i = 0; i < 600; i++) { await new Promise(r => setTimeout(r, 500)); const l = (await (await fetch(`http://127.0.0.1:${s.server.port}/api/project`)).json()).last; if (l && l.seq > last.seq) { next = l; break; } }
  if (!next?.ok) return fail('salvar não recompilou');
  console.log(`PASS salvar o main.cpp recompilou sozinho (build #${next.seq})`);
  ext.deactivate(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(errors.length ? 'FAIL ' + errors : 'extensão ok');
})();
