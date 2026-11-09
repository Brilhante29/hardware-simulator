// Compila um projeto PlatformIO inteiro (platformio.ini + src/ + include/ + lib/ + o que mais vier) e diz se o
// firmware roda no emulador do Hardware Studio. Usado pelo servidor local (tools/studio-server.mjs) e pela extensão do VS Code.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join, dirname, normalize, sep, isAbsolute } from 'node:path';

// Chips que o emulador executa hoje, com o relógio de 16 MHz das placas Arduino.
export const RUNNABLE = { atmega328p: 'ATmega328P', atmega2560: 'ATmega2560' };
const SKIP = /(^|\/)(\.pio|\.git|\.vscode|node_modules)(\/|$)/;

// Acha o pio: PATH, ou o ambiente que a extensão PlatformIO IDE instala em ~/.platformio/penv.
export function findPio() {
  const candidates = [process.env.PLATFORMIO_PATH, 'pio', 'platformio', join(homedir(), '.platformio', 'penv', 'bin', 'pio'), join(homedir(), '.platformio', 'penv', 'Scripts', 'pio.exe')].filter(Boolean);
  for (const c of candidates) { try { execFileSync(c, ['--version'], { stdio: 'pipe', timeout: 20000 }); return c; } catch {} }
  return null;
}

// platformio.ini → { defaultEnvs, envs: { nome: { platform, board, framework } } }, com herança simples de [env].
export function parseIni(text) {
  const sections = {}; let cur = null, lastKey = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s[;#].*$/, '').replace(/^\s*[;#].*$/, '');
    const sec = line.match(/^\s*\[([^\]]+)\]\s*$/); if (sec) { cur = sections[sec[1].trim()] ||= {}; lastKey = null; continue; }
    if (!cur || !line.trim()) continue;
    const kv = line.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*)$/);
    if (kv && !/^\s/.test(line)) { lastKey = kv[1]; cur[lastKey] = kv[2].trim(); } else if (lastKey) cur[lastKey] += '\n' + line.trim();
  }
  const base = sections.env || {}, envs = {};
  for (const [name, v] of Object.entries(sections)) if (name.startsWith('env:')) envs[name.slice(4)] = { ...base, ...v };
  const defaultEnvs = (sections.platformio?.default_envs || '').split(/[\s,]+/).filter(Boolean);
  return { defaultEnvs, envs };
}

// Lê o JSON da placa instalada pelo PlatformIO (build.mcu, build.f_cpu, nome comercial).
export function boardInfo(platform, board) {
  const plat = String(platform || '').replace(/^platformio\//, '').replace(/@.*$/, '').split('/').pop();
  const file = join(process.env.PLATFORMIO_CORE_DIR || join(homedir(), '.platformio'), 'platforms', plat, 'boards', `${board}.json`);
  try { const j = JSON.parse(readFileSync(file, 'utf8')); return { name: j.name, mcu: String(j.build?.mcu || '').toLowerCase(), fcpu: parseInt(j.build?.f_cpu, 10) || null }; } catch { return { name: board, mcu: null, fcpu: null }; }
}

// O que o emulador consegue fazer com esse alvo: roda, ou o motivo de não rodar (dito como o avrdude diria).
export function runnability({ platform, mcu, fcpu }) {
  if (RUNNABLE[mcu] && (!fcpu || fcpu === 16000000)) return { runnable: true };
  if (RUNNABLE[mcu]) return { runnable: false, reason: `${RUNNABLE[mcu]} a ${fcpu / 1e6} MHz: o emulador roda as placas de 16 MHz (Uno, Nano, Mega, Pro Mini 5 V). Use uma placa de 16 MHz no platformio.ini.` };
  if (/espressif32/.test(platform || '')) return { runnable: false, reason: `${mcu || 'ESP32'} compilou, mas o núcleo Xtensa/RISC-V do ESP32 ainda não é emulado no Hardware Studio (só AVR: ATmega328P e ATmega2560).` };
  return { runnable: false, reason: `${mcu || 'este chip'} compilou, mas o emulador só executa ATmega328P e ATmega2560.` };
}

// Arquivos vindos do navegador (pasta escolhida com webkitdirectory) → caminhos relativos seguros, sem a pasta de cima.
export function normalizeFiles(files) {
  const clean = [];
  for (const f of files) {
    const p = String(f.path || '').replace(/\\/g, '/').replace(/^\.?\/+/, '');
    if (!p || isAbsolute(p) || p.split('/').some(s => s === '..' || s === '') || SKIP.test(p)) continue;
    clean.push({ path: p, data: Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data || '', f.encoding === 'utf8' ? 'utf8' : 'base64') });
  }
  // Se tudo está dentro de uma pasta só (ex.: "relogio/platformio.ini"), essa pasta é a raiz do projeto.
  const ini = clean.filter(f => /(^|\/)platformio\.ini$/.test(f.path)).sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
  if (!ini) throw Object.assign(Error('A pasta precisa ter um platformio.ini (projeto PlatformIO).'), { status: 400 });
  const prefix = ini.path.slice(0, -'platformio.ini'.length);
  return { root: prefix.replace(/\/$/, '').split('/').pop() || 'projeto', files: clean.filter(f => f.path.startsWith(prefix)).map(f => ({ path: f.path.slice(prefix.length), data: f.data })) };
}

// Grava os arquivos numa pasta de trabalho estável por projeto (o .pio fica entre compilações: a segunda é incremental).
export function stageFiles(name, files) {
  const dir = join(tmpdir(), 'hardware-studio-builds', createHash('sha1').update(name).digest('hex').slice(0, 12));
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) if (entry !== '.pio') rmSync(join(dir, entry), { recursive: true, force: true });
  for (const f of files) { const out = normalize(join(dir, f.path)); if (!out.startsWith(dir + sep)) continue; mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, f.data); }
  return dir;
}

// pio run num projeto em disco. Devolve o firmware (Intel HEX no AVR; .bin/.elf no ESP32) e o log da compilação.
export function buildProject(dir, { env, preferMcu, pio = findPio(), timeoutMs = 15 * 60e3, onLog } = {}) {
  return new Promise(resolve => {
    const iniPath = join(dir, 'platformio.ini');
    if (!existsSync(iniPath)) return resolve({ ok: false, error: 'platformio.ini não encontrado na pasta do projeto.' });
    const ini = parseIni(readFileSync(iniPath, 'utf8')), names = Object.keys(ini.envs);
    if (!names.length) return resolve({ ok: false, error: 'O platformio.ini não tem nenhum [env:...].' });
    // Sem env pedido: o default_envs, a menos que outro [env] seja para o chip da placa escolhida (ex.: projeto com nano e mega).
    const mcuOf = e => (ini.envs[e]['board_build.mcu'] || boardInfo(ini.envs[e].platform, ini.envs[e].board).mcu || '').toLowerCase();
    const fallback = ini.defaultEnvs.find(e => ini.envs[e]) || names[0];
    const chosen = env && ini.envs[env] ? env : preferMcu && mcuOf(fallback) !== preferMcu ? names.find(e => mcuOf(e) === preferMcu) || fallback : fallback;
    const cfg = ini.envs[chosen], info = boardInfo(cfg.platform, cfg.board);
    if (cfg['board_build.mcu']) info.mcu = cfg['board_build.mcu'].toLowerCase();
    if (cfg['board_build.f_cpu']) info.fcpu = parseInt(cfg['board_build.f_cpu'], 10) || info.fcpu;
    if (!pio) return resolve({ ok: false, env: chosen, envs: names, error: 'PlatformIO (pio) não encontrado. Instale com "pip install platformio" ou pela extensão PlatformIO IDE.' });
    let log = ''; const add = s => { log += s; if (log.length > 400000) log = log.slice(-300000); onLog?.(s); };
    const child = spawn(pio, ['run', '-d', dir, '-e', chosen], { env: { ...process.env, PLATFORMIO_DISABLE_PROGRESSBAR: 'true', PLATFORMIO_NO_ANSI: 'true' } });
    const timer = setTimeout(() => { child.kill('SIGKILL'); add('\n[tempo esgotado]\n'); }, timeoutMs);
    child.stdout.on('data', d => add(d.toString())); child.stderr.on('data', d => add(d.toString()));
    child.on('error', e => { clearTimeout(timer); resolve({ ok: false, env: chosen, envs: names, error: e.message, log }); });
    child.on('close', code => {
      clearTimeout(timer);
      const out = join(dir, '.pio', 'build', chosen), pick = n => existsSync(join(out, n)) ? join(out, n) : null;
      const base = { env: chosen, envs: names, platform: cfg.platform, board: cfg.board, boardName: info.name, mcu: info.mcu, fcpu: info.fcpu, log };
      if (code !== 0) return resolve({ ok: false, ...base, error: `pio run terminou com código ${code} (veja o log).` });
      const hex = pick('firmware.hex'), bin = pick('firmware.bin'), elf = pick('firmware.elf');
      resolve({ ok: true, ...base, ...runnability(info), hex: hex ? readFileSync(hex, 'utf8') : null, bin: bin ? readFileSync(bin).toString('base64') : null,
        size: statSync(hex || bin || elf).size, artifact: hex || bin || elf });
    });
  });
}
