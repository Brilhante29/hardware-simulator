// Compilação de projetos inteiros (tools/lib/pio-build.mjs): leitura do platformio.ini, caminhos seguros, escolha do [env]
// pela placa e, quando o PlatformIO está instalado, o relógio de exemplo compilado de verdade para o Nano e para o Mega.
import { readFileSync } from 'node:fs';
import { parseIni, normalizeFiles, runnability, buildProject, findPio, stageFiles } from '../tools/lib/pio-build.mjs';
import { createMcu } from '../src/emulator/avr.mjs';

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
}
const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) { for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.error ? ': ' + x.error : ''}`); console.log(`${results.filter(x => x.pass).length}/${results.length} testes de compilação passaram`); if (results.some(x => !x.pass)) process.exitCode = 1; }
export { results };
