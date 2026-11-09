// Hardware Studio — tour da plataforma (~3 min): firmware real, projetos de saúde e acessibilidade, edge com IA, PCB e vitrine.
// Uso: node platform.cjs [prefixos...]   (o servidor de run-platform.sh precisa estar no ar na porta 8080)
const { setup, Recorder } = require('./lib.cjs');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out-platform'); fs.mkdirSync(OUT, { recursive: true });

const slide = (D, id, v) => D.page.evaluate(([id, v]) => { const el = document.querySelector(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
async function example(D, id) {
  await D.goto('/editor.html?example=' + id, { covered: true });
  await D.page.waitForFunction(() => project.parts.some(p => p.settings?.firmware), null, { timeout: 15000 });
  await D.page.click('#fitButton'); await D.wait(300);
}
async function select(D, partId) { await D.click(`#partLayer .part[data-part=${partId}]`, 300); }

const SEGMENTS = {
  async '1-abertura'(D) {
    await D.title('', 'hardware<b>studio</b>', 'firmware de verdade, sem hardware na mesa', 2400);
    await D.goto('/', { covered: true });
    await D.uncover(520);
    await D.caption('', 'Uma oficina <b>aberta</b>', 'right top');
    await D.cam('.workshop', 1.25, 900, .5, .6);
    await D.click('[data-scenario=overvoltage]', 1500);
    await D.click('#restore', 600);
    await D.camReset(700); await D.hide();
    await D.cover(520);
  },

  async '2-relogio'(D) {
    const p = D.page;
    await D.title('01', 'o código <b>real</b> roda aqui', 'PlatformIO compila · o ATmega328P emulado executa', 1800);
    await example(D, 'relogio-cor');
    await D.uncover(520);
    await D.caption('Relógio colorido', 'Tela redonda <b>GC9A01</b> + batimento', 'right top');
    await D.click('#runButton', 300);
    await D.cam('#partLayer .part[data-part=t1]', 2.0, 900, .55, .45); await D.wait(4200);
    await D.camReset(700);
    await select(D, 'm1');
    await D.caption('MPU6050', 'Caminhando: <b>passos</b>', 'right top');
    await slide(D, '[data-sensor=walk]', 130); await D.wait(400);
    await D.cam('#partLayer .part[data-part=t1]', 2.0, 800, .55, .45); await D.wait(4000);
    await D.camReset(600); await D.hide();
    await D.click('#runButton', 200);
    await D.cover(520);
  },

  async '3-queda'(D) {
    await D.title('02', 'pulseira de <b>queda</b>', 'queda livre → impacto → imóvel = alerta', 1700);
    await example(D, 'queda');
    await D.uncover(520);
    await D.click('#runButton', 2200);
    await select(D, 'm1');
    await D.caption('', 'Simular <b>queda</b>', 'right top');
    await D.click('#mpuFall', 300);
    await D.cam('#partLayer .part[data-part=o1]', 2.2, 800, .5, .5); await D.wait(4600);
    await D.caption('', '10 s sem resposta: <b>sirene</b>', 'right top');
    await D.wait(8200);
    await D.camReset(600); await D.hide();
    await D.click('#runButton', 200);
    await D.cover(520);
  },

  async '4-bengala'(D) {
    await D.title('03', 'bengala <b>inteligente</b>', 'o obstáculo vira vibração e som', 1600);
    await example(D, 'bengala');
    await D.uncover(520);
    await D.click('#runButton', 1500);
    await select(D, 'u1');
    await D.caption('HC-SR04', 'Mais perto, <b>mais forte</b>', 'right top');
    for (const cm of [180, 120, 70, 35, 18]) { await slide(D, '[data-sensor=distanceCm]', cm); await D.wait(1300); }
    await D.cam('#partLayer .part[data-part=o1]', 2.0, 700, .5, .5); await D.wait(1600);
    await D.camReset(500); await D.hide();
    await D.click('#runButton', 200);
    await D.cover(520);
  },

  async '5-estacao'(D) {
    await D.title('04', 'estação de <b>conforto</b>', 'índice de calor e luz em LEDs', 1500);
    await example(D, 'estacao');
    await D.uncover(520);
    await D.click('#runButton', 2600);
    await select(D, 'b1');
    await D.caption('BME280', 'Esquentou: <b>vermelho</b>', 'right top');
    await slide(D, '[data-sensor=temperature]', 36); await slide(D, '[data-sensor=humidity]', 78);
    await D.cam('#partLayer .part[data-part=x1]', 1.8, 800, .5, .5); await D.wait(3600);
    await D.camReset(500); await D.hide();
    await D.click('#runButton', 200);
    await D.cover(520);
  },

  async '6-avc'(D) {
    const p = D.page;
    await D.title('05', 'antes do <b>AVC</b>', 'PPG → ritmo irregular → edge → pré-laudo', 2000);
    await D.goto('/avc.html', { covered: true });
    await D.uncover(520);
    await D.caption('HS-Pulse', 'Ritmo <b>sinusal</b>', 'right top');
    await D.scrollTo('#painel', 'start', 900);
    await D.wait(9000);
    await D.caption('Fibrilação atrial', 'Intervalos <b>irregulares</b>', 'right top');
    await D.click('[data-rhythm=af]', 200); await slide(D, '#bpm', 108);
    await p.waitForFunction(() => /fibrila/.test(document.querySelector('#status').textContent), null, { timeout: 60000 }).catch(() => {});
    await D.cam('#poincare', 1.6, 800); await D.wait(2400); await D.camReset(600);
    await D.caption('Edge + RAG', 'Pré-laudo para o <b>médico</b>', 'right top');
    await D.click('#report', 400);
    await D.cam('.clinic', 1.35, 800, .5, .75); await D.wait(4200); await D.camReset(600); await D.hide();
    await D.cover(520);
  },

  async '7-pcb'(D) {
    const p = D.page;
    await D.title('06', 'do circuito à <b>placa</b>', 'posiciona · roteia · confere · Gerber', 1700);
    await D.goto('/pcb.html?example=relogio-cor-placa', { covered: true });
    await p.waitForFunction(() => /pronta|problema/.test(document.querySelector('#drcStatus').textContent), null, { timeout: 20000 });
    await D.uncover(520);
    await D.caption('Ø 40 mm', 'Roteada em <b>0,3 s</b>', 'right top');
    await D.cam('.view', 1.25, 800); await D.wait(1800); await D.camReset(500);
    await D.caption('DRC', 'Arraste: <b>reroteia</b>', 'right top');
    await D.drag('.comp[aria-label^="R2"]', 60, 40); await D.wait(1800);
    await D.click('#autoButton', 1800);
    await p.selectOption('#mask', 'black'); await D.wait(500);
    await D.click('.seg button[data-mode="3d"]', 1800);
    await D.caption('Fabricação', 'Gerber · furação · <b>BOM</b>', 'right top');
    await D.cam('#drcStatus', 1.6, 700); await D.wait(1700); await D.camReset(500); await D.hide();
    await D.cover(520);
  },

  async '8-vitrine'(D) {
    await D.title('07', 'um relógio que ainda <b>não existe</b>', '', 1500);
    await D.goto('/watch.html', { covered: true });
    await D.uncover(520); await D.wait(2600);
    await D.caption('', 'Firmware real · <b>PCB real</b>', 'right top');
    await D.click('#explode', 2600);
    await D.drag('#stage', 50, 20); await D.wait(1400);
    await D.click('#explode', 1800); await D.hide();
    await D.cover(520);
  },

  async '9-codigo'(D) {
    const p = D.page;
    await D.title('08', 'no seu <b>VS Code</b>', 'salvou → compilou → rodou', 1500);
    await D.goto('/__demo/image.html?src=/docs/media/vscode-relogio.png', { covered: true });
    await D.uncover(500); await D.wait(3200);
    await D.cover(480);
    await D.goto('/__demo/terminal.html?fast', { covered: true });
    await p.addStyleTag({ content: '#demo-cursor{display:none!important}' });
    await D.uncover(480);
    await p.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
    D.sfx('win'); await D.wait(1400);
    await D.cover(500);
    await D.title('', 'hardware<b>studio</b>', 'simule antes de comprar · fabrique com confiança', 2600);
    await D.title('código aberto · MIT', 'github.com/<b>Brilhante29</b>', 'hardware-simulator', 2400);
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
