// Compilação de projetos inteiros (tools/lib/pio-build.mjs): leitura do platformio.ini, caminhos seguros, escolha do [env]
// pela placa e, quando o PlatformIO está instalado, o relógio de exemplo compilado de verdade para o Nano e para o Mega.
import { readFileSync } from 'node:fs';
import { parseIni, normalizeFiles, runnability, buildProject, findPio, stageFiles } from '../tools/lib/pio-build.mjs';
import { createMcu } from '../src/emulator/avr.mjs';
import { startServer } from '../tools/studio-server.mjs';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const results = [];
const test = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const ok = (c, m) => { if (!c) throw Error(m || 'falhou'); };

await test('platformio.ini: [env] herdado, default_envs e lib_deps em várias linhas', () => {
  const ini = parseIni(readFileSync(new URL('../examples/firmware/relogio/platformio.ini', import.meta.url), 'utf8'));
  ok(ini.defaultEnvs.join() === 'nano', ini.defaultEnvs); ok(Object.keys(ini.envs).join() === 'nano,uno,mega');
  ok(ini.envs.mega.platform === 'atmelavr' && ini.envs.mega.board === 'megaatmega2560'); ok(ini.envs.uno.lib_deps.split('\n').length === 5, ini.envs.uno.lib_deps);
});
await test('Pasta enviada: raiz pelo platformio.ini; .pio, .git e caminhos com .. ou absolutos ficam de fora', () => {
  const f = (path, s = 'x') => ({ path, data: Buffer.from(s).toString('base64') });
  const r = normalizeFiles([f('relogio/platformio.ini', '[env:uno]'), f('relogio/src/main.cpp'), f('relogio/.pio/build/x.o'), f('relogio/../../etc/passwd'), f('/etc/shadow'), f('relogio/.git/config'), f('outro/a.txt')]);
  ok(r.root === 'relogio'); ok(r.files.map(x => x.path).sort().join() === 'platformio.ini,src/main.cpp', r.files.map(x => x.path));
  let threw = false; try { normalizeFiles([f('src/main.cpp')]); } catch { threw = true; } ok(threw, 'sem platformio.ini foi aceito');
});
await test('O que roda: AVR de 16 MHz sim; 8 MHz e ESP32 dizem o motivo', () => {
  ok(runnability({ mcu: 'atmega328p', fcpu: 16000000 }).runnable); ok(runnability({ mcu: 'atmega2560', fcpu: 16000000 }).runnable);
  ok(/16 MHz/.test(runnability({ mcu: 'atmega328p', fcpu: 8000000 }).reason)); ok(/ESP32|Xtensa/.test(runnability({ platform: 'espressif32', mcu: 'esp32' }).reason));
});
if (findPio()) {
  const files = ['platformio.ini', 'src/main.cpp'].map(p => ({ path: p, data: readFileSync(new URL(`../examples/firmware/relogio/${p}`, import.meta.url)) }));
  const dir = stageFiles('teste-relogio', files);
  await test('pio run de verdade: placa Nano escolhe o [env:nano] e o firmware dá boot', async () => {
    const r = await buildProject(dir, { preferMcu: 'atmega328p' }); ok(r.ok, r.error + '\n' + (r.log || '').slice(-600));
    ok(r.env === 'nano' && r.mcu === 'atmega328p' && r.runnable, JSON.stringify({ env: r.env, mcu: r.mcu })); const m = createMcu(r.hex); let out = ''; m.onSerial = b => out += String.fromCharCode(b); m.runSeconds(0.3); ok(out.includes('relogio pronto'), out);
  });
  await test('pio run de verdade: placa Mega escolhe o [env:mega] do mesmo projeto', async () => {
    const r = await buildProject(dir, { preferMcu: 'atmega2560' }); ok(r.ok && r.env === 'mega' && r.mcu === 'atmega2560' && r.runnable, r.error || r.env);
  });
  await test('Servidor --project: circuito da pasta, gravação do circuito e recompilação ao salvar', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hs-proj-')), src = new URL('../examples/firmware/relogio/', import.meta.url);
    for (const f of ['platformio.ini', 'hardware-studio.json', 'src']) cpSync(new URL(f, src), join(tmp, f), { recursive: true });
    const srv = await startServer({ port: 0, project: tmp, log: () => {} }), base = `http://127.0.0.1:${srv.port}`;
    try {
      const wait = async (cond, ms = 240000) => { for (let t = 0; t < ms; t += 300) { const p = await (await fetch(base + '/api/project')).json(); if (cond(p)) return p; await new Promise(r => setTimeout(r, 300)); } throw Error('tempo esgotado'); };
      const p1 = await wait(p => p.last); ok(p1.last.ok && p1.last.env === 'nano' && p1.circuit.parts.length === 14 && p1.circuit.parts.find(x => x.id === 'm1').settings.ad0 === 'HIGH', JSON.stringify(p1.last.error));
      const c = { ...p1.circuit, title: 'Relógio v2' };
      ok((await fetch(base + '/api/project/circuit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) })).ok, 'POST circuito');
      ok(JSON.parse(readFileSync(join(tmp, 'hardware-studio.json'), 'utf8')).title === 'Relógio v2', 'circuito não gravado');
      ok((await fetch(base + '/api/project/circuit', { method: 'POST', headers: { origin: 'https://site-de-fora.example' }, body: '{}' })).status === 403, 'origem de fora aceita');
      writeFileSync(join(tmp, 'src/main.cpp'), readFileSync(join(tmp, 'src/main.cpp'), 'utf8').replace('relogio pronto', 'relogio salvo'));
      const p2 = await wait(p => p.last && p.last.seq > p1.last.seq); ok(p2.last.ok, p2.last.error);
      const m = createMcu(p2.last.hex); let out = ''; m.onSerial = b => out += String.fromCharCode(b); m.runSeconds(0.3); ok(out.includes('relogio salvo'), out);
    } finally { srv.close(); rmSync(tmp, { recursive: true, force: true }); }
  });
}
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${results.filter(x => x.pass).length}/${results.length} testes de compilação passaram`); if (results.some(x => !x.pass)) process.exitCode = 1; }
export { results };
