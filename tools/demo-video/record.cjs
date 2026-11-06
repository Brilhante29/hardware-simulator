// Hardware Studio — roteiro de gravação. Uso: node record.cjs [seg1 seg2 ...]
const { setup, Recorder } = require('./lib.cjs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const PROJ = path.join(__dirname, 'projects');

const SEGMENTS = {
  async '01-oficina'(D) {
    const p = D.page;
    await D.goto('/');
    await D.chapterOn('▶', 'HARDWARE STUDIO · TOUR GUIADO', 'Uma oficina de hardware<br>dentro do <b>navegador</b>.', 'Circuitos que respondem, falhas de propósito, placas combinadas e 24 grupos de testes automatizados. Sem instalar nada.', ['RC analítico', 'LED DC', 'SN74HC595', '114 referências', 'Editor livre', 'Import Wokwi']);
    await D.wait(4800); await D.chapterOff(); await D.wait(600);
    await D.caption('01 · Oficina', 'Pixel art que <b>simula de verdade</b>', 'O canvas da página inicial usa o mesmo modelo elétrico da bancada: fonte, resistor e capacitor.', 'right top');
    await D.hover('#workshopCanvas', 900);
    await D.click('.robot-wave', 2200);
    await D.scroll(330);
    await D.caption('E se eu mudar a tensão?', '12 V: <b>tudo tranquilo</b>', 'Carga RC analítica — a tensão sobe, a corrente cai, a potência no resistor acompanha.', 'right top');
    await D.click('[data-scenario=nominal]', 300); await D.spot('.live-readings', 6); await D.wait(3200); await D.spotOff();
    await D.caption('Passando do limite', '32 V num capacitor de <b>16 V</b>', 'Sobretensão: o modelo avisa o estresse sem inventar uma falha automática.', 'right top');
    await D.click('[data-scenario=overvoltage]', 300); await D.spot('#sceneFeedback', 6); await D.wait(3400); await D.spotOff();
    await D.caption('Modo “eita!”', '100× a tensão: <b>1.600 V</b>', 'Falha didática injetada ao cruzar 16 V. Na abertura, I e P no resistor caem a zero.', 'right top');
    await D.click('[data-scenario=extreme]', 300); await D.wait(1200); await D.spot('.live-readings', 6); await D.wait(3200); await D.spotOff();
    await D.caption('Troca de peça', 'Substituir e <b>recomeçar</b>', 'O botão ↻ coloca um capacitor novo na bancada.', 'right top');
    await D.click('#restore', 1800);
    await D.hide(); await D.scroll(-330);
    await D.caption('Aparência', 'Tema <b>escuro</b>: lua, estrelas e luz noturna', 'A escolha inicial acompanha o sistema e só a preferência fica salva no navegador.');
    await D.click('[data-theme-choice=dark]', 3000);
    await D.caption('Acessibilidade', 'Cores <b>acessíveis</b> com pistas além da cor', 'Azul/dourado, contraste reforçado e símbolos — nos dois temas.');
    await D.click('[data-vision-trigger]', 350); await D.click('[data-vision-trigger]', 900);
    await D.hover('label:has(#visionEnabled)', 900); await D.click('.vision-confirm', 2600);
    await D.click('[data-vision-trigger]', 700); await D.click('#visionEnabled', 500); await D.click('.vision-confirm', 600);
    await D.click('[data-theme-choice=light]', 1200);
    await D.hide();
    await D.scrollTo('#experimentos', 'start');
    await D.caption('Três cartuchos', 'Escolha seu <b>primeiro experimento</b>', 'Capacitor no limite, LED que acende ou queima, e lógica digital com 8 bits.', 'right top');
    for (const c of ['.cartridge.green', '.cartridge.peach', '.cartridge.lavender']) await D.hover(c, 1100);
    await D.scrollTo('.open-lab', 'center');
    await D.caption('Código aberto', 'Abre o código. <b>Inventa o próximo.</b>', 'MIT, sem conta, sem backend: o projeto fica no seu navegador.', 'right top');
    await D.wait(2600); await D.hide(); await D.wait(400);
  },

  async '02-bancada-capacitor'(D) {
    const p = D.page;
    await D.goto('/studio.html?scenario=nominal');
    await D.chapter('02', 'BANCADA DE MEDIÇÃO', 'Pequeno componente.<br><b>Grandes consequências.</b>', 'Passo simulado de 5 ms, histórico de 360 pontos e falhas que mudam o circuito inteiro.', ['Capacitor', 'Energia ½CV²', 'Falha aberta', 'Curto-circuito'], 3600);
    await D.caption('Simular', '12 V · 1 kΩ · 100 µF', 'Aperte Simular e acompanhe tensão, corrente, potência e energia.', 'right top');
    await D.click('#runButton', 2000);
    await D.scroll(470); await D.spot('.measurements, #measureOne', 4);
    await D.caption('Medições ao vivo', 'Energia armazenada: <b>E = ½CV²</b>', 'O gráfico mostra a curva de carga; a linha tracejada é a tensão nominal.', 'right top');
    await D.wait(3200); await D.spotOff(); await D.scroll(-470);
    await D.caption('Esquema', 'Mesma bancada, <b>visão de esquema</b>', 'Alterne entre o circuito ilustrado e o diagrama elétrico.', 'right top');
    await D.click('#schematicButton', 2000); await D.click('#circuitTab', 900);
    await D.caption('Ajuste fino', 'Arraste a fonte: <b>24 V</b>', 'Qualquer parâmetro editado vira um cenário Personalizado.', 'right top');
    const sl = await p.locator('#voltageSlider').boundingBox();
    await D.moveTo(sl.x + sl.width * 0.25, sl.y + sl.height / 2); await p.mouse.down();
    await D.moveTo(sl.x + sl.width * 0.5, sl.y + sl.height / 2, 30); await p.mouse.up(); await D.wait(400);
    await D.click('#runButton', 2600);
    await D.caption('Cenário extremo', '100× a tensão + <b>falha em curto</b>', 'Agora a ruptura vira curto: a fonte limita a 200 mA e R1 dissipa 40 W.', 'right top');
    await D.hover('#scenarioSelect', 200); await p.selectOption('#scenarioSelect', 'extreme'); await D.wait(500);
    await D.hover('#failureSelect', 200); await p.selectOption('#failureSelect', 'short'); await D.wait(500);
    await D.click('#runButton', 2600);
    await D.scroll(520);
    await D.caption('Causa → efeito → evidência', 'O circuito <b>conta a história</b>', 'Estímulo, componente e consequência ficam encadeados e com fontes.', 'right top');
    await D.spot('#causalChain', 6); await D.wait(3600); await D.spotOff();
    await D.scroll(-520);
    await D.caption('Falha aberta', 'Mesma tensão, <b>outra consequência</b>', 'Na abertura, corrente e potência no resistor caem a zero.', 'right top');
    await D.click('#resetButton', 300); await p.selectOption('#failureSelect', 'open'); await D.wait(300);
    await D.click('#runButton', 3000);
    await D.hide();
  },

  async '03-bancada-led'(D) {
    const p = D.page;
    await D.goto('/studio.html?scenario=led-nominal');
    await D.chapter('03', 'LUZ & CORRENTE', 'O LED <b>sobrevive?</b>', 'Vf fixo, alertas de corrente, potência, tensão reversa e temperatura estimada.', ['5 V / 330 Ω', '12 V / 100 Ω', 'Polaridade invertida', 'SFR25 @ 70 °C'], 3400);
    await D.caption('LED protegido', '5 V com <b>330 Ω</b>: 9,39 mA', 'Corrente segura, potência no resistor bem abaixo do limite.', 'right top');
    await D.click('#runButton', 2600);
    await D.caption('Sobrecarga', '12 V com <b>100 Ω</b>', 'LED e resistor passam dos limites — o painel acusa os dois.', 'right top');
    await D.hover('#scenarioSelect', 200); await p.selectOption('#scenarioSelect', 'led-overload'); await D.wait(300);
    await D.click('#runButton', 3200);
    await D.caption('Proteção', 'Limite da fonte: <b>20 mA</b>', 'Limitar a corrente protege LED e resistor ao mesmo tempo.', 'right top');
    await D.type('#limitInput', '20'); await p.keyboard.press('Tab'); await D.wait(400);
    await D.click('#runButton', 3000);
    await D.caption('Polaridade invertida', 'LED ao contrário com <b>12 V</b>', 'Até 5 V reverso é o limite; acima disso, alerta.', 'right top');
    await D.hover('#scenarioSelect', 200); await p.selectOption('#scenarioSelect', 'led-reverse'); await D.wait(300);
    await D.click('#runButton', 3000);
    await D.caption('Ambiente quente', 'Resistor a <b>70 °C</b>', 'Referência SFR25: 0,4 W a 70 °C, metade a 112,5 °C, zero a 155 °C.', 'right top');
    await D.hover('#scenarioSelect', 200); await p.selectOption('#scenarioSelect', 'led-nominal'); await D.wait(300);
    await D.click('details.advanced summary', 600); await D.type('#ambientInput', '70'); await p.keyboard.press('Tab'); await D.wait(300);
    await D.click('#runButton', 3000);
    await D.hide();
  },

  async '04-biblioteca-validacao-codigo'(D) {
    const p = D.page;
    await D.goto('/studio.html');
    await D.chapter('04', 'BIBLIOTECA · VALIDAÇÃO · IDE', '114 referências.<br><b>Testes na própria página.</b>', 'Placas, SoCs, MCUs e periféricos com o estado de cada modelo à vista — e validação exportável.', ['ESP32', 'STM32', 'RP2040', 'Arduino', 'PlatformIO'], 3400);
    await D.click('a[data-view=library]', 900);
    await D.caption('Biblioteca', 'Hardware <b>sem fronteiras</b>', 'Busque por placa, chip ou fabricante. Cada ficha diz o que já é simulado.', 'right top');
    await D.type('#catalogSearch', 'ESP32', 110); await D.wait(1800);
    await D.type('#catalogSearch', 'STM32', 110); await D.wait(1600);
    await D.type('#catalogSearch', 'sensor', 110); await D.wait(1600);
    await D.type('#catalogSearch', '', 50); await D.wait(600);
    const opts = await p.$$eval('#catalogFilter option', o => o.map(x => x.value).filter(Boolean));
    await D.hover('#catalogFilter', 200);
    for (const v of opts.slice(0, 3)) { await p.selectOption('#catalogFilter', v); await D.wait(1300); }
    await p.selectOption('#catalogFilter', ''); await D.wait(400);
    await D.click('a[data-view=tests]', 800);
    await D.caption('Validação', 'Rodar <b>24 grupos</b> de testes no navegador', '8 digitais + 16 elétricos, com relatório JSON exportável.', 'right top');
    await D.click('#runTests', 1800);
    await D.spot('#testSummary', 6); await D.wait(2200); await D.spotOff();
    await D.scroll(900, 50); await D.wait(800); await D.scroll(-900, 30);
    await D.click('a[data-view=code]', 900);
    await D.caption('Código & IDE', 'Exporta <b>sketch Arduino</b> ou projeto <b>PlatformIO</b>', 'Gera .ino ou um .zip pronto — sem compilar nem fazer upload ainda.', 'right top');
    await D.spot('#codePreview', 6); await D.wait(2600); await D.spotOff();
    await D.click('#downloadArduino', 1200);
    await D.click('#downloadPIO', 1600);
    await D.hide();
  },

  async '05-editor-livre'(D) {
    const p = D.page;
    await D.goto('/editor.html'); await p.evaluate(() => localStorage.clear()); await D.goto('/editor.html');
    await D.chapter('05', 'EDITOR LIVRE', 'Monte, ligue os fios,<br><b>aperte simular.</b>', 'Peças, fios, componentes personalizados, desfazer/refazer, JSON e um interpretador de digitalWrite/delay.', ['Arduino Uno', 'Fios', 'Peça custom', 'Sketch'], 3400);
    await D.caption('Exemplo', 'LED piscando no <b>pino 13</b>', 'Arduino Uno, resistor de 220 Ω e LED — direto do sketch.', 'canvas');
    await D.click('#runButton', 2800);
    await D.click('#codeTab', 800);
    await D.caption('Edite o sketch', 'Mais rápido: <b>delay(120)</b>', 'O interpretador lê cada digitalWrite + delay e anima o circuito.', 'canvas');
    await D.click('#runButton', 300);
    await p.evaluate(() => { const t = document.querySelector('#codeEditor'); t.focus(); t.setSelectionRange(0, 0); });
    const code = await p.inputValue('#codeEditor');
    await p.fill('#codeEditor', code.replace(/delay\(500\)/g, 'delay(120)')); await p.dispatchEvent('#codeEditor', 'input');
    await D.wait(400); await D.click('#runButton', 3000); await D.click('#runButton', 400);

    await D.caption('Do zero', 'Circuito em branco → <b>botão + LED</b>', 'Clique nas peças da biblioteca, posicione e conecte os pinos.', 'canvas');
    await D.click('#examplesButton', 900); await D.click('[data-example=empty]', 900);
    await D.click('#propertiesTab', 200);
    const add = async (type, dx, dy) => { await D.click(`[data-add=${type}]`, 350); await D.drag('#partLayer .part:last-child .part-card', dx, dy); };
    await add('source', -330, 0); await add('button', -130, 0); await add('resistor', 80, 0); await add('led', 300, 0);
    await D.click('#fitButton', 700);
    await D.click('#wireTool', 400);
    const pin = (n, name) => `#partLayer .part:nth-child(${n}) .pin[data-pin="${name}"]`;
    for (const [a, b] of [[pin(1, '+'), pin(2, '1')], [pin(2, '2'), pin(3, '1')], [pin(3, '2'), pin(4, 'A')], [pin(4, 'K'), pin(1, '−')]]) {
      await D.click(a, 250); await D.click(b, 450);
    }
    await D.click('#selectTool', 400);
    await D.caption('Simular', 'Fecha o contato: <b>luz!</b>', 'Continuidade calculada por nós: fonte → botão → resistor → LED → fonte.', 'canvas');
    await D.click('#runButton', 1200);
    await D.click('#partLayer .part:nth-child(2) .part-card', 500); await D.click('#toggleButtonPart', 2000);
    await D.click('#toggleButtonPart', 1000); await D.click('#toggleButtonPart', 1600);
    await D.click('#runButton', 400);
    await D.caption('Peça personalizada', 'Criar um <b>sensor cardíaco</b> do nada', 'Nome, categoria e pinos — vira item da biblioteca local.', 'canvas');
    await D.click('#customPartButton', 700);
    await D.type('#customName', 'Sensor cardíaco MAX30102', 40);
    await D.hover('#customCategory', 200); await p.selectOption('#customCategory', 'Sensores'); await D.wait(300);
    await D.type('#customPins', 'VCC, GND, SDA, SCL, INT', 40);
    await D.click('#createCustomPart', 1200);
    await D.drag('#partLayer .part:last-child .part-card', 0, 170); await D.click('#fitButton', 1200);
    await D.caption('Desfazer / refazer', 'Errou? <b>↶ ↷</b>', 'Histórico de 50 passos, salvamento automático no navegador.', 'canvas');
    await D.click('#undoButton', 700); await D.click('#undoButton', 900); await D.click('#redoButton', 700); await D.click('#redoButton', 1400);
    await D.hide();
  },

  async '06-combinacoes'(D) {
    const p = D.page;
    await D.goto('/editor.html'); await p.evaluate(() => localStorage.clear()); await D.goto('/editor.html');
    await D.chapter('06', 'COMBINAÇÕES INVENTADAS', 'Juntando placas<br>e peças em <b>projetos novos</b>.', 'Três montagens criadas para este tour: importadas como JSON e Wokwi, ligadas e simuladas.', ['Semáforo + travessia', '2× Uno em sincronia', 'Uno + ESP32 alarme'], 3600);
    const imp = async (file) => { await D.hover('#importButton', 300); await p.mouse.down(); await p.mouse.up(); await p.setInputFiles('#importFile', path.join(PROJ, file)); await D.wait(700); await D.click('#fitButton', 600); };
    // Combo 1
    await D.caption('Combo 1', 'Semáforo com <b>travessia sonora</b>', '1 Uno · 5 LEDs · 5 resistores · buzzer. D13/D12/D11 para carros, D9/D10 para pedestres, D8 apita.', 'canvas');
    await imp('semaforo-travessia.json');
    await D.click('#codeTab', 600);
    await D.click('#runButton', 9500);
    await D.click('#runButton', 400);
    // Combo 2
    await D.caption('Combo 2', 'Duas placas, <b>um só sketch</b>', 'Uno A (mestre) ligado ao Uno B pelo serial: as duas fazem a mesma varredura de LEDs.', 'canvas');
    await imp('placas-sincronia.json');
    await D.click('#runButton', 6500);
    await D.click('#runButton', 400);
    // Combo 3
    await D.caption('Combo 3 · Wokwi', 'Alarme anti-intruso: <b>Uno + ESP32</b>', 'diagram.json do Wokwi com sonar HC-SR04, sirene, estrobos, servo de câmera e relé de holofote.', 'canvas');
    await imp('diagram.json'); await D.wait(1400);
    await D.caption('Ligação manual', 'Serial cruzado: <b>TX0 → D0 · RX0 → D1</b>', 'O ESP32 entra como placa importada; os fios do serial são ligados à mão.', 'canvas');
    await D.click('#wireTool', 300);
    const esp = '#partLayer .part[data-part=esp]', uno = '#partLayer .part[data-part=uno]';
    for (const [a, b] of [[`${esp} .pin[data-pin=TX0]`, `${uno} .pin[data-pin=D0]`], [`${esp} .pin[data-pin=RX0]`, `${uno} .pin[data-pin=D1]`], [`${esp} .pin[data-pin="GND.1"]`, `${uno} .pin[data-pin=GND]`]]) {
      await D.click(a, 250); await D.click(b, 500);
    }
    await D.click('#selectTool', 300);
    await D.click('#codeTab', 500);
    await D.caption('Firmware', 'Sirene: <b>estrobo + bipe</b>', 'D13 vermelho, D12 azul, D8 buzzer — alternando a cada 150 ms.', 'canvas');
    const siren = '// Alarme: sonar detectou movimento\nvoid loop() {\n  digitalWrite(13, HIGH); delay(150);\n  digitalWrite(8, HIGH);  delay(150);\n  digitalWrite(13, LOW);  delay(0);\n  digitalWrite(12, HIGH); delay(150);\n  digitalWrite(8, LOW);   delay(150);\n  digitalWrite(12, LOW);  delay(0);\n}';
    await D.click('#codeEditor', 200); await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
    await p.keyboard.type(siren, { delay: 9 }); await D.wait(500);
    await D.click('#runButton', 3500);
    await D.caption('Modo noturno', 'Alarme disparado <b>no escuro</b>', 'Tema escuro no editor, simulação continua rodando.', 'canvas');
    await D.click('[data-theme-choice=dark]', 4500);
    await D.click('#runButton', 300); await D.click('[data-theme-choice=light]', 300);
    await D.hide();
  },

  async '07-registrador-595'(D) {
    const p = D.page;
    await D.goto('/lab/sn74hc595.html');
    await D.chapter('07', 'LÓGICA DIGITAL', 'Oito bits.<br><b>Muitas ideias.</b>', 'SN74HC595 com estados X/Z, clocks, latch, clear e OE — os 256 bytes conferidos contra o datasheet da TI.', ['SER', 'SRCLK', 'RCLK', 'OE', 'SRCLR'], 3400);
    await D.caption('Enviar + latch', 'Byte <b>165 = 1010 0101</b>', 'Os bits entram em série (MSB primeiro) e só aparecem nas saídas após o latch.', 'right top');
    await D.click('#send', 1100); await D.spot('#leds', 8); await D.wait(900); await D.click('#latch', 1900); await D.spotOff();
    for (const [v, t] of [['255', 'Todos acesos: <b>1111 1111</b>'], ['170', 'Alternado: <b>1010 1010</b>'], ['15', 'Meio a meio: <b>0000 1111</b>']]) {
      await D.caption('Novos bytes', t, 'Shift sem latch não altera a saída armazenada.', 'right top');
      await D.type('#value', v, 90); await D.click('#send', 900); await D.click('#latch', 1600);
    }
    await D.caption('Output enable', 'OE alto: saídas em <b>alta impedância (Z)</b>', 'Desabilitar não destrói os dados — ao religar, o byte volta.', 'right top');
    await D.click('#oe', 2000); await D.click('#oe', 1500);
    await D.click('#clear', 700); await D.click('#latch', 1500);
    await D.caption('Comparação', 'Conferindo com o <b>datasheet</b>', 'Power-up, 256 bytes, clocks, clear, OE, eventos inválidos…', 'right top');
    await D.click('#test', 900); await D.scrollTo('#results', 'center'); await D.spot('#results', 8); await D.wait(3000); await D.spotOff();
    await D.hide();
  },

  async '08-testes'(D) {
    await D.goto('/__demo/terminal.html');
    await D.page.addStyleTag({ content: '#demo-cursor{display:none!important}' });
    await D.page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
    await D.wait(2500);
  },

  async '09-encerramento'(D) {
    await D.goto('/');
    await D.page.click('[data-theme-choice=dark]'); await D.wait(1500);
    await D.caption('Hardware Studio', 'Seu próximo <b>“e se?”</b> começa aqui.', 'Abra a bancada, mude uma coisa, veja o que acontece.', 'right top');
    await D.click('[data-scenario=extreme]', 3800); await D.hide();
    await D.chapterOn('✦', 'CÓDIGO ABERTO · MIT', 'Hardware Studio', 'github.com/Brilhante29/hardware-simulator — rode com python3 -m http.server e abra localhost:8080.', ['index.html', 'studio.html', 'editor.html', 'lab/sn74hc595.html']);
    await D.wait(5200);
    await D.page.click('[data-theme-choice=light]').catch(() => {});
  },
};

(async () => {
  const pick = process.argv.slice(2); const names = Object.keys(SEGMENTS).filter(n => !pick.length || pick.some(x => n.startsWith(x)));
  for (const name of names) {
    const { browser, page, D } = await setup();
    await D.goto('/'); await page.evaluate(() => localStorage.clear());
    await page.goto('about:blank');
    const rec = new Recorder(name, OUT);
    // start screencast after first navigation in segment
    const origGoto = D.goto; let started = false;
    D.goto = async url => { await origGoto(url); if (!started) { started = true; await rec.start(page); await D.wait(400); } };
    const t = Date.now();
    try { await SEGMENTS[name](D); } catch (e) { console.error(name, 'FAILED:', e.message); await page.screenshot({ path: path.join(OUT, name + '-error.png') }); }
    const r = await rec.stop(); console.log(name, r.frames, 'frames', r.seconds.toFixed(1) + 's', ((Date.now() - t) / 1000).toFixed(1));
    await browser.close();
  }
})();
