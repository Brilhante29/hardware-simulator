// Extensão do VS Code: abre o Hardware Studio ao lado do código, vigia a pasta do projeto PlatformIO e, a cada salvar,
// recompila com o pio e roda o firmware novo no circuito. O servidor é o mesmo do "node tools/studio-server.mjs --project".
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let session = null; // { dir, server, panel }

// Pasta com platformio.ini: a do arquivo aberto (subindo diretórios) ou a primeira do workspace.
function findProject() {
  const up = start => { let d = start; for (let i = 0; i < 12 && d; i++) { if (fs.existsSync(path.join(d, 'platformio.ini'))) return d; const p = path.dirname(d); if (p === d) break; d = p; } return null; };
  const doc = vscode.window.activeTextEditor?.document;
  if (doc?.uri.scheme === 'file') { const d = up(path.dirname(doc.uri.fsPath)); if (d) return d; }
  for (const f of vscode.workspace.workspaceFolders || []) { const d = up(f.uri.fsPath); if (d) return d; }
  return null;
}

function studioRoot(context) {
  // Empacotado: media/ tem uma cópia do Studio. Rodando do repositório (F5): a pasta de cima.
  const media = path.join(context.extensionPath, 'media');
  return fs.existsSync(path.join(media, 'tools', 'studio-server.mjs')) ? media : path.join(context.extensionPath, '..');
}

function html(url) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:* https:; style-src 'unsafe-inline';">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden;background:#fff}</style></head>
<body><iframe src="${url}" allow="clipboard-read; clipboard-write; autoplay"></iframe></body></html>`;
}

async function open(context) {
  const dir = findProject();
  if (!dir) { vscode.window.showErrorMessage('Hardware Studio: nenhum platformio.ini neste workspace.'); return; }
  if (session && session.dir !== dir) { session.server.close(); session.panel?.dispose(); session = null; }
  if (!session) {
    const root = studioRoot(context), out = vscode.window.createOutputChannel('Hardware Studio');
    const pio = vscode.workspace.getConfiguration('hardwareStudio').get('pioPath'); if (pio) process.env.PLATFORMIO_PATH = pio;
    const { startServer } = await import(pathToFileURL(path.join(root, 'tools', 'studio-server.mjs')).href);
    const server = await startServer({ port: 0, project: dir, root, log: s => out.append(s) });
    session = { dir, server, out };
    context.subscriptions.push({ dispose: () => session?.server.close() });
  }
  if (session.panel) { session.panel.reveal(vscode.ViewColumn.Beside); return session; }
  const external = await vscode.env.asExternalUri(vscode.Uri.parse(`http://127.0.0.1:${session.server.port}/editor.html`));
  const panel = vscode.window.createWebviewPanel('hardwareStudio', `Hardware Studio · ${path.basename(dir)}`, vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
  panel.webview.html = html(external.toString(true));
  panel.onDidDispose(() => { if (session) session.panel = null; });
  session.panel = panel;
  return session;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hardwareStudio.open', () => open(context)),
    vscode.commands.registerCommand('hardwareStudio.rebuild', async () => { const s = session || await open(context); s?.server.rebuild?.('comando do VS Code'); })
  );
}
function deactivate() { session?.server.close(); session = null; }
module.exports = { activate, deactivate, _session: () => session };
