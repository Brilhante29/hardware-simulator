#!/usr/bin/env node
// Servidor local do Hardware Studio: serve o Studio e compila projetos PlatformIO com o pio da sua máquina.
// Uso:  node tools/studio-server.mjs [--port 8080] [--project ./meu-projeto]
//  - sem --project: abra http://localhost:8080/editor.html, selecione a placa e use "Compilar pasta…".
//  - com --project: a pasta é vigiada; cada vez que você salva (src/, include/, lib/, platformio.ini) ela é recompilada
//    e o firmware novo vai sozinho para a placa no editor (é o modo que a extensão do VS Code usa).
// Só escuta em 127.0.0.1: nada sai da sua máquina.
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { join, normalize, extname, sep, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject, normalizeFiles, stageFiles, findPio } from './lib/pio-build.mjs';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.hex': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.wav': 'audio/wav' };
const MAX_BODY = 40 * 1024 * 1024;
const WATCHED = /^(platformio\.ini|src\/|include\/|lib\/|data\/|test\/)/;
const CIRCUIT = 'hardware-studio.json'; // circuito do projeto (peças, fios, ajustes), versionado junto com o código
const readJson = text => { try { return JSON.parse(text); } catch { return null; } };

export function startServer({ port = 8080, host = '127.0.0.1', project = null, root = ROOT, log = s => process.stderr.write(s) } = {}) {
  let pio = null, queue = Promise.resolve();
  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const readBody = req => new Promise((ok, fail) => { let size = 0; const chunks = []; req.on('data', c => { size += c.length; if (size > MAX_BODY) { fail(Object.assign(Error('Projeto grande demais (máx. 40 MB).'), { status: 413 })); req.destroy(); } else chunks.push(c); }); req.on('end', () => ok(Buffer.concat(chunks))); req.on('error', fail); });
  // Uma compilação por vez: o PlatformIO não gosta de duas no mesmo projeto ao mesmo tempo.
  const serial = fn => { const job = queue.then(fn); queue = job.catch(() => {}); return job; };
  const compile = (dir, label, opts) => serial(async () => {
    pio ||= findPio(); log(`▶ compilando ${label}\n`);
    const r = await buildProject(dir, { ...opts, pio });
    log(r.ok ? `■ ${r.env}: ${r.boardName} (${r.mcu}) · ${r.size} bytes${r.runnable ? '' : ' · ' + r.reason}\n` : `✗ ${r.error}\n`);
    return r;
  });

  // ---- projeto local vigiado (--project) ----
  const proj = project ? { dir: resolve(project), name: basename(resolve(project)), last: null, building: false, clients: new Set(), seq: 0 } : null;
  const broadcast = (event, data) => { for (const res of proj.clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  async function rebuild(reason) {
    if (proj.building) { proj.again = true; return; }
    proj.building = true; broadcast('building', { reason });
    const r = await compile(proj.dir, `${proj.name} (${reason})`, { env: proj.env });
    proj.last = { ...r, seq: ++proj.seq, project: proj.name, log: r.ok ? undefined : r.log?.slice(-6000) }; proj.building = false; broadcast('build', proj.last);
    if (proj.again) { proj.again = false; rebuild('alterações durante a compilação'); }
  }
  if (proj) {
    if (!existsSync(join(proj.dir, 'platformio.ini'))) throw Error(`${proj.dir} não tem platformio.ini`);
    let timer = null;
    proj.watcher = watch(proj.dir, { recursive: true }, (_, file) => {
      const rel = String(file || '').split(sep).join('/');
      if (rel === CIRCUIT) { readFile(join(proj.dir, CIRCUIT), 'utf8').then(t => { const c = readJson(t); if (c && JSON.stringify(c) !== proj.written) { proj.written = JSON.stringify(c); broadcast('circuit', c); } }).catch(() => {}); return; }
      if (!WATCHED.test(rel)) return;
      clearTimeout(timer); timer = setTimeout(() => rebuild(rel), 350);
    });
  }

  async function handleUpload(req, res) {
    let body; try { body = JSON.parse((await readBody(req)).toString('utf8')); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.status ? e.message : 'JSON inválido.' }); }
    let p; try { p = normalizeFiles(body.files || []); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }); }
    try { const dir = stageFiles(body.name || p.root, p.files); const r = await compile(dir, `${p.root} (${p.files.length} arquivos)`, { env: body.env, preferMcu: body.mcu }); const cf = p.files.find(f => f.path === CIRCUIT); send(res, r.ok ? 200 : 422, { ...r, project: p.root, circuit: cf ? readJson(cf.data.toString('utf8')) : null }); }
    catch (e) { send(res, 500, { ok: false, error: e.message }); }
  }
  async function handleStatic(req, res) {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path)); if (!file.startsWith(root + sep)) return send(res, 403, 'proibido', 'text/plain');
    try { if (!(await stat(file)).isFile()) throw 0; send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream'); } catch { send(res, 404, 'não encontrado', 'text/plain'); }
  }

  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url.startsWith('/api/')) {
      // Só páginas servidas por este servidor podem pedir compilação (um site de fora não usa o seu pio).
      const origin = req.headers.origin; if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { ok: false, error: 'Origem não permitida.' });
      if (req.method === 'GET' && url === '/api/health') { pio ||= findPio(); return send(res, 200, { ok: true, pio: !!pio, version: 2, project: proj?.name || null }); }
      if (req.method === 'POST' && url === '/api/build') return handleUpload(req, res);
      if (proj && req.method === 'GET' && url === '/api/project') return readFile(join(proj.dir, CIRCUIT), 'utf8').catch(() => null).then(t => send(res, 200, { name: proj.name, dir: proj.dir, last: proj.last, building: proj.building, circuit: t ? readJson(t) : null }));
      if (proj && req.method === 'POST' && url === '/api/project/circuit') return readBody(req).then(async b => {
        const c = readJson(b.toString('utf8')); if (!c || !Array.isArray(c.parts) || !Array.isArray(c.wires)) return send(res, 400, { ok: false, error: 'circuito inválido' });
        proj.written = JSON.stringify(c); await writeFile(join(proj.dir, CIRCUIT), JSON.stringify(c, null, 2) + '\n'); send(res, 200, { ok: true });
      }).catch(e => send(res, e.status || 500, { ok: false, error: e.message }));
      if (proj && req.method === 'POST' && url === '/api/project/build') { rebuild('pedido do editor'); return send(res, 202, { ok: true }); }
      if (proj && req.method === 'GET' && url === '/api/project/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(': ok\n\n');
        proj.clients.add(res); if (proj.last) res.write(`event: build\ndata: ${JSON.stringify(proj.last)}\n\n`);
        const ping = setInterval(() => res.write(': ping\n\n'), 20000); req.on('close', () => { clearInterval(ping); proj.clients.delete(res); }); return;
      }
      return send(res, 404, { ok: false, error: 'rota desconhecida' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'método não permitido', 'text/plain');
    handleStatic(req, res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      const real = server.address().port; pio = findPio();
      log(`Hardware Studio em http://localhost:${real}/editor.html${proj ? `  · projeto ${proj.dir} (recompila ao salvar)` : ''}\n${pio ? `PlatformIO: ${pio}` : 'PlatformIO não encontrado: instale com "pip install platformio" (ou a extensão PlatformIO IDE).'}\n`);
      if (proj) rebuild('início');
      ok({ port: real, url: `http://localhost:${real}/editor.html`, server, rebuild: proj ? rebuild : null, close: () => { proj?.watcher.close(); for (const c of proj?.clients || []) c.end(); server.close(); } });
    });
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2), opt = n => args.includes(n) ? args[args.indexOf(n) + 1] : undefined;
  startServer({ port: Number(opt('--port') ?? process.env.PORT ?? 8080), project: opt('--project') }).catch(e => { console.error(e.message); process.exit(1); });
}
