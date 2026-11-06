// Hardware Studio — tour v2 (dinâmico). Uso: node record2.cjs [prefixos...]
const { setup, Recorder } = require('./lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const PROJ = path.join(__dirname, 'projects');

async function importProject(D, file) {
  const p = D.page; await p.setInputFiles('#importFile', path.join(PROJ, file)); await D.wait(350);
  await p.click('#fitButton'); await D.wait(250);
}

const SEGMENTS = {
  async '1-oficina'(D) {
    const p = D.page;
    await D.title('', 'hardware<b>studio</b>', 'seu próximo “e se?” começa aqui', 2100);
    await D.goto('/', { covered: true });
    await D.uncover(520);
    await D.wait(2300);
    await D.caption('', 'Clica. Muda. <b>Descobre.</b>', 'right top');
    await D.hover('#workshopCanvas', 500);
    await D.cam('.workshop', 1.32, 900, .5, .62);
    await D.click('[data-scenario=overvoltage]', 1300);
    await D.hide();
    await D.cam('#workshopCanvas', 1.9, 700, .78, .45);
    await D.click('[data-scenario=extreme]', 2200);
    await D.cam('.workshop', 1.32, 650, .5, .62);
    await D.click('#restore', 700);
    await D.caption('', 'Dá um oi pro <b>robô</b>', 'right top');
    await D.click('.robot-wave', 2600);
    await D.hide();
    await D.cam('.experiment-controls', 1.55, 700, .5, 1.6);
    await D.wait(1300);
    await D.camReset(750);
    await D.caption('', 'De dia <b>ou de noite</b>', 'right top');
    await D.click('[data-theme-choice=dark]', 1700);
    await D.click('[data-theme-choice=light]', 500);
    await D.hide();
    await D.scrollTo('#experimentos', 'start', 1100);
    for (const c of ['.cartridge.green', '.cartridge.peach', '.cartridge.lavender']) {
      const [x, y] = await D.center(c); await D.moveTo(x - 90, y + 90); await D.moveTo(x + 90, y - 110, 18); await D.wait(150);
    }
    await D.caption('', 'Escolha um <b>cartucho</b>', 'right top');
    await p.evaluate(() => { document.querySelector('.cartridge.green').href = 'javascript:void 0'; });
    await D.click('.cartridge.green', 330);
    await D.cover(520);
  },

  async '2-bancada'(D) {
    const p = D.page;
    await D.title('02', 'até onde <b>aguenta?</b>', '', 1300);
    await D.goto('/studio.html?scenario=extreme', { covered: true });
    await p.selectOption('#failureSelect', 'short');
    await D.wait(300);
    await D.uncover(520);
    await D.caption('', '1.600 V num capacitor de <b>16 V</b>', 'right top');
    await D.click('#runButton', 200);
    await D.hide();
    await D.cam('#circuit', 1.7, 700, .74, .5);
    D.sfx('boom'); await D.wait(2300);
    await D.camReset(650);
    await D.page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' })); await D.wait(900);
    await D.caption('', 'Causa → efeito → <b>evidência</b>', 'right top');
    await D.cam('#causalChain', 1.35, 700); await D.wait(1400);
    await D.camReset(600); await D.hide();
    await D.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await D.wait(700);
    await D.click('#ledExperiment', 300);
    await p.selectOption('#scenarioSelect', 'led-overload'); await D.wait(200);
    await D.caption('', 'Acender. <b>Ou queimar?</b>', 'right top');
    await D.click('#runButton', 200);
    await D.cam('#circuit', 1.6, 700, .74, .55); await D.wait(1900);
    await D.camReset(600); await D.hide();
    await D.click('a[data-view=library]', 300);
    await D.caption('', '114 <b>referências</b>', 'right top');
    await p.locator('#catalogSearch').click(); await p.keyboard.type('ESP32', { delay: 70 }); await D.wait(900);
    await D.click('details.library-notice summary', 1100);
    await D.click('a[data-view=tests]', 200); await D.hide();
    await D.click('#runTests', 200);
    await D.caption('', '24/24 <b>passando</b>', 'right top');
    await D.cam('#testSummary', 1.6, 600); await D.wait(1200); await D.camReset(500);
    await D.cover(520);
  },

  async '3-editor'(D) {
    const p = D.page;
    await D.title('03', 'monte e <b>combine</b>', '', 1300);
    await D.goto('/editor.html', { covered: true });
    await p.evaluate(() => localStorage.clear());
    await D.goto('/editor.html', { covered: true });
    await importProject(D, 'semaforo-travessia.json');
    await D.uncover(520);
    await D.caption('', 'Semáforo com <b>travessia</b>', 'canvas');
    await D.click('#runButton', 200);
    await D.cam('#partLayer .part[data-part=lrg]', 1.55, 800, .2, .3);
    await D.wait(4200);
    await D.camReset(600); await D.hide();
    await D.click('#runButton', 100);
    await importProject(D, 'placas-sincronia.json');
    await D.caption('', '2 placas, <b>1 sketch</b>', 'canvas');
    await D.click('#runButton', 200);
    await D.cam('#partLayer .part[data-part=ub]', 1.35, 800, -.3, .3);
    await D.wait(3000);
    await D.camReset(600); await D.hide();
    await D.click('#runButton', 100);
    await importProject(D, 'diagram.json');
    await D.caption('Wokwi', 'Uno + <b>ESP32</b>', 'canvas');
    await D.click('#wireTool', 150);
    const esp = '#partLayer .part[data-part=esp]', uno = '#partLayer .part[data-part=uno]';
    for (const [a, b] of [[`${esp} .pin[data-pin=TX0]`, `${uno} .pin[data-pin=D0]`], [`${esp} .pin[data-pin=RX0]`, `${uno} .pin[data-pin=D1]`]]) { await D.click(a, 120); await D.click(b, 200); }
    await D.click('#selectTool', 100);
    await p.evaluate(c => { const t = document.querySelector('#codeEditor'); t.value = c; t.dispatchEvent(new Event('input')); }, '// Alarme: sonar detectou movimento\nvoid loop() {\n  digitalWrite(13, HIGH); delay(150);\n  digitalWrite(8, HIGH);  delay(150);\n  digitalWrite(13, LOW);  delay(0);\n  digitalWrite(12, HIGH); delay(150);\n  digitalWrite(8, LOW);   delay(150);\n  digitalWrite(12, LOW);  delay(0);\n}');
    await D.hide();
    await D.click('[data-theme-choice=dark]', 300);
    await D.caption('', 'Alarme <b>disparado</b>', 'canvas');
    await D.click('#runButton', 200);
    await D.cam('#partLayer .part[data-part=led1]', 1.5, 800, .5, 1.1);
    await D.wait(3200);
    await D.camReset(500);
    await D.cover(520);
    await p.click('#runButton'); await p.click('[data-theme-choice=light]');
  },

  async '4-logica-testes'(D) {
    const p = D.page;
    await D.title('04', 'oito <b>bits</b>', '', 1100);
    await D.goto('/lab/sn74hc595.html', { covered: true });
    await D.uncover(500);
    await D.cam('#leds', 1.35, 600, .5, .2);
    for (const v of ['165', '255', '170', '15', '129']) {
      await p.fill('#value', v); await D.click('#send', 60); await D.click('#latch', 380);
    }
    await D.click('#oe', 500); await D.click('#oe', 450);
    await D.camReset(500);
    await D.cover(480);
    await D.goto('/__demo/terminal.html?fast', { covered: true });
    await p.addStyleTag({ content: '#demo-cursor{display:none!important}' });
    await D.uncover(480);
    await p.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
    D.sfx('win'); await D.wait(1300);
    await D.cover(500);
  },

  async '5-final'(D) {
    await D.title('', 'hardware<b>studio</b>', 'abra · mude · descubra', 2600);
    await D.title('código aberto · MIT', 'github.com/<b>Brilhante29</b>', 'hardware-simulator', 2200);
  },
};

(async () => {
  const pick = process.argv.slice(2); const names = Object.keys(SEGMENTS).filter(n => !pick.length || pick.some(x => n.startsWith(x)));
  for (const name of names) {
    const rec = new Recorder(name, OUT);
    const { browser, page, D } = await setup(rec);
    await page.goto('http://localhost:8080/__demo/cover.html'); await page.evaluate(() => { localStorage.clear(); window.__demo.init(); document.getElementById('demo-wipe').classList.add('covered'); });
    await rec.start(page); await D.wait(300);
    try { await SEGMENTS[name](D); } catch (e) { console.error(name, 'FAILED:', e.message.split('\n')[0]); await page.screenshot({ path: path.join(OUT, name + '-error.png') }); }
    const r = await rec.stop(); console.log(name, r.seconds.toFixed(1) + 's', r.events, 'sfx');
    await browser.close();
  }
})();
