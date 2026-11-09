#!/usr/bin/env node
// Servidor local do Hardware Studio: serve o Studio e compila projetos PlatformIO inteiros enviados pelo navegador.
// Uso:  node tools/studio-server.mjs [--port 8080]      → abra http://localhost:8080/editor.html
// No editor, selecione a placa e use "Compilar pasta…": a pasta (platformio.ini, src/, include/, lib/…) é enviada para cá,
// compilada com o seu PlatformIO e o firmware volta para a placa. Só escuta em 127.0.0.1 (nada sai da sua máquina).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject, normalizeFiles, stageFiles, findPio } from './lib/pio-build.mjs';

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const args = process.argv.slice(2), port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.hex': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.wav': 'audio/wav' };
const MAX_BODY = 40 * 1024 * 1024;
let pio = null, queue = Promise.resolve();

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
function readBody(req) {
  return new Promise((resolve, reject) => { let size = 0; const chunks = []; req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(Error('Projeto grande demais (máx. 40 MB).'), { status: 413 })); req.destroy(); } else chunks.push(c); }); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
}

async function handleBuild(req, res) {
  let body; try { body = JSON.parse((await readBody(req)).toString('utf8')); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.status ? e.message : 'JSON inválido.' }); }
  let project; try { project = normalizeFiles(body.files || []); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }); }
  // Uma compilação por vez: o PlatformIO não gosta de duas no mesmo projeto ao mesmo tempo.
  const job = queue.then(async () => {
    pio ||= findPio();
    const dir = stageFiles(body.name || project.root, project.files);
    process.stderr.write(`▶ compilando ${project.root} (${project.files.length} arquivos) em ${dir}\n`);
    const r = await buildProject(dir, { env: body.env, preferMcu: body.mcu, pio });
    process.stderr.write(r.ok ? `■ ${r.env}: ${r.boardName} (${r.mcu}) · ${r.size} bytes${r.runnable ? '' : ' · ' + r.reason}\n` : `✗ ${r.error}\n`);
    return r;
  });
  queue = job.catch(() => {});
  try { const r = await job; send(res, r.ok ? 200 : 422, { ...r, project: project.root }); } catch (e) { send(res, 500, { ok: false, error: e.message }); }
}

async function handleStatic(req, res) {
  const url = new URL(req.url, 'http://localhost'); let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root + sep)) return send(res, 403, 'proibido', 'text/plain');
  try { const st = await stat(file); if (!st.isFile()) throw 0; send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream'); } catch { send(res, 404, 'não encontrado', 'text/plain'); }
}

const server = createServer((req, res) => {
  // Só páginas servidas por este servidor podem pedir compilação (bloqueia sites de fora usando o seu pio).
  const origin = req.headers.origin, host = req.headers.host;
  if (req.url.startsWith('/api/')) {
    if (origin && new URL(origin).host !== host) return send(res, 403, { ok: false, error: 'Origem não permitida.' });
    if (req.method === 'GET' && req.url === '/api/health') { pio ||= findPio(); return send(res, 200, { ok: true, pio: !!pio, version: 1 }); }
    if (req.method === 'POST' && req.url === '/api/build') return handleBuild(req, res);
    return send(res, 404, { ok: false, error: 'rota desconhecida' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'método não permitido', 'text/plain');
  handleStatic(req, res);
});
server.listen(port, '127.0.0.1', () => {
  pio = findPio();
  process.stderr.write(`Hardware Studio em http://localhost:${port}/editor.html  (boot: /boot.html)\n${pio ? `PlatformIO: ${pio}` : 'PlatformIO não encontrado: "Compilar pasta" vai pedir para instalar (pip install platformio).'}\n`);
});
