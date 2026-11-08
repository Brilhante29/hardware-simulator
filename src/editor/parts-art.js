// Arte em pixel das peças do editor. Cada desenho usa o tamanho e os pinos do catálogo,
// então os terminais terminam exatamente onde o pino é clicável.
(() => {
  const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"/>`;
  const F = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:${color}"/>`;
  const T = (x, y, s, c, size = 10, anchor = 'start') => `<text x="${x}" y="${y}" class="pt ${c}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function disc(cx, cy, r, c, colorStyle) {
    let out = '';
    for (let y = -r; y < r; y += 2) { const yy = y + 1; const hw = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy)) / 2) * 2; if (hw > 0) out += colorStyle ? F(cx - hw, cy + y, hw * 2, 2, colorStyle) : R(cx - hw, cy + y, hw * 2, 2, c); }
    return out;
  }
  // terminal horizontal até a borda (x=0 ou x=W)
  const leadL = (y, to) => R(0, y - 1, to, 2, 'mt');
  const leadR = (y, from, W) => R(from, y - 1, W - from, 2, 'mt');

  // Código de cores IEC 60062 a partir do valor ("220 Ω", "4,7 kΩ", "1k").
  const COLORS = ['#1b1b1b', '#7a4a23', '#d23b2f', '#f08a24', '#f2d23c', '#3a9a4a', '#2f6fd1', '#8a4fd1', '#8c8c8c', '#f4f4f4'];
  function bands(text) {
    const m = String(text).replace(',', '.').match(/([\d.]+)\s*([kKmM]?)/); let ohms = m ? parseFloat(m[1]) : 220;
    if (m && /k/i.test(m[2])) ohms *= 1e3; if (m && m[2] === 'M') ohms *= 1e6;
    if (!(ohms >= 1)) return [COLORS[2], COLORS[2], COLORS[1]];
    const exp = Math.floor(Math.log10(ohms)) - 1, digits = Math.round(ohms / 10 ** exp);
    const d1 = Math.min(9, Math.floor(digits / 10)), d2 = digits % 10, mult = Math.max(0, Math.min(9, exp));
    return [COLORS[d1], COLORS[d2], COLORS[mult]];
  }
  // Linha do LCD: texto em fonte mono e, nas células com caractere criado (CGRAM), os 5×8 pontos de verdade.
  function lcdLine(x, y, text, row, glyphs, fs) {
    const cw = fs * 0.6, dot = cw / 5.2, rowH = fs * 0.95 / 8; let dots = '';
    for (const [key, rows] of Object.entries(glyphs || {})) {
      const [r, c] = key.split(',').map(Number); if (r !== row) continue;
      rows.forEach((bits, yy) => { for (let xx = 0; xx < 5; xx++) if ((bits >> (4 - xx)) & 1) dots += R(+(x + c * cw + xx * dot).toFixed(2), +(y - fs * 0.8 + yy * rowH).toFixed(2), +(dot * 0.92).toFixed(2), +(rowH * 0.92).toFixed(2), 'lcdt'); });
    }
    return T(x, y, esc(String(text).replace(/▒/g, ' ')).replace(/ /g, '&#160;'), 'lcdt mono', fs) + dots;
  }
  const ART = {
    uno(def, part) {
      let s = R(6, 2, 170, 216, 'k') + R(8, 4, 166, 212, 'ub');
      s += R(28, 58, 64, 2, 'ub2') + R(90, 58, 2, 42, 'ub2') + R(24, 172, 92, 2, 'ub2') + R(114, 150, 2, 24, 'ub2') + R(132, 96, 2, 50, 'ub2');
      s += R(10, 18, 12, 172, 'k'); for (let i = 0; i < 14; i++) { const y = 26 + i * 12; s += R(0, y - 1, 10, 2, 'mt') + R(14, y - 2, 4, 4, 'mt'); }
      s += R(160, 30, 12, 168, 'k'); [38, 58, 78, 98, 118, 138, 164, 190].forEach(y => { s += R(164, y - 2, 4, 4, 'mt') + R(172, y - 1, 10, 2, 'mt'); });
      s += R(110, 0, 36, 26, 'mt2') + R(114, 2, 28, 20, 'mt') + R(58, 0, 34, 20, 'k') + R(62, 4, 26, 12, 'd');
      s += R(64, 120, 72, 26, 'ic') + R(64, 129, 4, 8, 'ub');
      for (let i = 0; i < 8; i++) s += R(68 + i * 8, 116, 4, 4, 'mt') + R(68 + i * 8, 146, 4, 4, 'mt');
      s += R(100, 72, 20, 8, 'mt') + R(36, 30, 14, 14, 'k') + R(38, 32, 10, 10, 'o');
      s += T(36, 104, 'UNO', 'c', 24) + T(38, 192, '~ DIGITAL', 'p', 7);
      const on = part?.settings?.outputs?.D13 === 1;
      s += R(140, 62, 10, 6, on ? 'ledL on' : 'ledL') + T(152, 69, 'L', 'p', 7) + R(140, 80, 10, 6, 'g') + T(152, 87, 'ON', 'p', 7);
      return s;
    },
    // Mega 2560: 101,6 × 53,3 mm (Uno: 68,6 mm), em pé como o Uno. D0–D21 à esquerda, A0–A15 à direita, D22–D53 no conector duplo.
    mega(def, part) {
      let s = R(6, 2, 170, 336, 'k') + R(8, 4, 166, 332, 'ub');
      s += R(28, 58, 64, 2, 'ub2') + R(90, 58, 2, 56, 'ub2') + R(24, 262, 112, 2, 'ub2') + R(134, 96, 2, 120, 'ub2') + R(40, 200, 2, 62, 'ub2');
      s += R(10, 18, 12, 268, 'k'); for (let i = 0; i < 22; i++) { const y = 26 + i * 12; s += R(0, y - 1, 10, 2, 'mt') + R(14, y - 2, 4, 4, 'mt'); }
      s += R(160, 22, 12, 242, 'k'); [...Array(16)].map((_, i) => 30 + i * 12).concat([236, 256]).forEach(y => { s += R(164, y - 2, 4, 4, 'mt') + R(172, y - 1, 10, 2, 'mt'); });
      s += R(9, 320, 164, 18, 'k'); for (let k = 0; k < 16; k++) { const x = 16 + k * 10; s += R(x - 2, 324, 4, 4, 'mt') + R(x - 2, 331, 4, 4, 'mt') + R(x - 1, 335, 2, 5, 'mt'); }
      s += R(110, 0, 36, 26, 'mt2') + R(114, 2, 28, 20, 'mt') + R(58, 0, 34, 20, 'k') + R(62, 4, 26, 12, 'd');
      s += R(54, 118, 74, 74, 'k') + R(58, 122, 66, 66, 'ic') + R(62, 126, 5, 5, 'mt2');
      for (let i = 0; i < 12; i++) { const o = 62 + i * 5; s += R(o, 114, 2, 4, 'mt') + R(o, 192, 2, 4, 'mt') + R(50, o, 4, 2, 'mt') + R(128, o, 4, 2, 'mt'); }
      s += R(98, 72, 22, 14, 'ic') + R(36, 30, 14, 14, 'k') + R(38, 32, 10, 10, 'o');
      s += T(48, 232, 'MEGA', 'c', 24) + T(50, 250, '2560', 'p', 11) + T(30, 314, 'DIGITAL 22–53', 'p', 7) + T(91, 162, 'ATMEGA', 'mt2', 8, 'middle') + T(91, 172, '2560', 'mt2', 8, 'middle');
      const on = part?.settings?.outputs?.D13 === 1;
      s += R(140, 62, 10, 6, on ? 'ledL on' : 'ledL') + T(152, 69, 'L', 'p', 7) + R(140, 80, 10, 6, 'g') + T(152, 87, 'ON', 'p', 7);
      return s;
    },
    led(def, part) {
      const col = esc(part?.settings?.color || '#63c879');
      let s = `<g style="--led:${col}">`;
      s += leadL(38, 30) + leadR(38, 52, 82) + T(4, 30, '+', 'm', 9);
      s += `<g class="rays">${R(40, 0, 2, 4, 'ray')}${R(18, 10, 4, 2, 'ray')}${R(60, 10, 4, 2, 'ray')}${R(22, 2, 2, 4, 'ray')}${R(58, 2, 2, 4, 'ray')}</g>`;
      s += `<g class="bulb">${R(34, 8, 14, 2, 'lb')}${R(30, 10, 22, 2, 'lb')}${R(28, 12, 26, 26, 'lb')}${R(26, 38, 30, 6, 'lr')}</g>`;
      s += R(32, 14, 4, 10, 'hl') + R(32, 26, 2, 4, 'hl');
      return s + '</g>';
    },
    resistor(def, part) {
      let s = leadL(34, 26) + leadR(34, 78, 104);
      s += R(24, 28, 6, 12, 'rb') + R(74, 28, 6, 12, 'rb') + R(28, 26, 48, 16, 'rb') + R(28, 26, 48, 3, 'rbh') + R(28, 39, 48, 3, 'rbs');
      const [b1, b2, mult] = bands(part?.settings?.value || '220 Ω');
      return s + F(36, 26, 4, 16, b1) + F(44, 26, 4, 16, b2) + F(52, 26, 4, 16, mult) + F(66, 26, 4, 16, '#d6a83a');
    },
    button(def, part) {
      let s = leadL(34, 24) + leadR(34, 58, 82) + R(22, 12, 38, 42, 'k') + R(24, 14, 34, 38, 'd');
      [[26, 16], [52, 16], [26, 46], [52, 46]].forEach(([x, y]) => { s += R(x, y, 4, 4, 'mt'); });
      return s + `<g class="cap">${disc(41, 35, 11, 'r')}${disc(41, 33, 11, 'o')}${R(36, 28, 4, 4, 'hl')}</g>`;
    },
    switch(def, part) {
      const on = !!part?.settings?.pressed;
      return leadL(34, 24) + leadR(34, 70, 94) + R(22, 20, 50, 28, 'k') + R(24, 22, 46, 24, 'd') + R(30, 30, 34, 8, 'k') + R(on ? 48 : 32, 26, 14, 16, 'c') + R(on ? 50 : 34, 28, 10, 2, 'p') + T(47, 16, on ? 'ON' : 'OFF', on ? 'g' : 'm', 8, 'middle');
    },
    source() {
      let s = R(8, 4, 64, 60, 'k') + R(10, 6, 60, 56, 'p') + R(16, 12, 48, 20, 'k') + T(40, 27, '5.0V', 'g', 12, 'middle');
      s += R(0, 35, 14, 2, 'mt') + F(12, 32, 10, 10, '#e25a4f') + F(14, 34, 6, 6, '#ff8b7d');
      s += R(66, 35, 14, 2, 'mt') + R(58, 32, 10, 10, 'k') + R(60, 34, 6, 6, 'd');
      return s + disc(40, 48, 6, 'm') + R(39, 43, 2, 5, 'k') + T(16, 58, 'PSU', 'm', 7);
    },
    vcc() { return R(28, 32, 44, 2, 'mt') + R(26, 10, 4, 4, 'o') + R(22, 14, 12, 4, 'o') + R(18, 18, 20, 4, 'o') + R(26, 22, 4, 18, 'o') + R(18, 40, 20, 4, 'sy'); },
    gnd() { return R(30, 32, 42, 2, 'mt') + R(28, 12, 4, 22, 'sy') + R(14, 32, 32, 4, 'sy') + R(20, 38, 20, 4, 'sy') + R(26, 44, 8, 4, 'sy') ; },
    buzzer() {
      let s = leadL(35, 22) + leadR(35, 60, 82) + disc(41, 34, 20, 'k') + disc(41, 34, 16, 'ic') + disc(41, 34, 5, 'p') + T(28, 24, '+', 'c', 9);
      return s + `<g class="waves">${R(66, 22, 2, 6, 'wv')}${R(68, 28, 2, 14, 'wv')}${R(66, 42, 2, 6, 'wv')}${R(14, 22, 2, 6, 'wv')}${R(12, 28, 2, 14, 'wv')}${R(14, 42, 2, 6, 'wv')}</g>`;
    },
    pot() {
      return leadL(17, 26) + leadL(60, 26) + leadR(39, 78, 104) + R(24, 10, 56, 58, 'k') + R(26, 12, 52, 54, 'bp') + disc(52, 39, 16, 'c') + R(50, 27, 4, 24, 'm') + R(40, 37, 24, 4, 'm') + R(30, 14, 4, 4, 'p') + R(70, 60, 4, 4, 'p');
    },
    display(def, part) {
      const lines = part?.settings?.lines, lit = lines ? part.settings.backlight !== false : true;
      const t1 = lines ? lines[0] : String(part?.settings?.screen || 'HELLO WORLD').slice(0, 8), t2 = lines ? lines[1] : String(part?.settings?.screen || 'HELLO WORLD').slice(8);
      let s = R(0, 17, 10, 2, 'mt') + R(0, 53, 10, 2, 'mt') + R(102, 24, 10, 2, 'mt') + R(102, 47, 10, 2, 'mt');
      s += R(8, 2, 96, 68, 'k') + R(10, 4, 92, 64, 'bd') + R(14, 12, 84, 46, 'k') + R(18, 16, 76, 38, lit ? 'lcd' : 'lcdoff');
      const fs = lines ? 7.6 : 11;
      return s + lcdLine(20, 32, t1, 0, part?.settings?.glyphs, fs) + lcdLine(20, 47, t2, 1, part?.settings?.glyphs, fs) + R(12, 6, 4, 4, 'mt') + R(96, 6, 4, 4, 'mt');
    },
    // LCD paralelo: mesmo módulo verde, terminais RS/E à esquerda e D4–D7 à direita.
    lcd1602(def, part) {
      const lines = part?.settings?.lines, t1 = lines ? lines[0] : 'LiquidCrystal', t2 = lines ? lines[1] : '4 bits';
      let s = def.pins.map(([, x, y]) => x === 0 ? R(0, y - 1, 10, 2, 'mt') : R(102, y - 1, 10, 2, 'mt')).join('');
      s += R(8, 2, 96, 84, 'k') + R(10, 4, 92, 80, 'bd') + R(14, 20, 84, 46, 'k') + R(18, 24, 76, 38, 'lcd');
      for (let i = 0; i < 16; i++) s += R(14 + i * 5, 8, 3, 3, 'mt');
      return s + lcdLine(20, 40, t1, 0, part?.settings?.glyphs, lines ? 7.6 : 9) + lcdLine(20, 55, t2, 1, part?.settings?.glyphs, lines ? 7.6 : 9);
    },
    oled() {
      let s = leadL(18, 10) + leadL(40, 10) + leadR(28, 102, 112) + leadR(52, 102, 112);
      s += R(8, 2, 96, 80, 'k') + R(10, 4, 92, 76, 'bp') + R(14, 14, 84, 46, 'k');
      [[14, 6], [92, 6], [14, 72], [92, 72]].forEach(([x, y]) => { s += disc(x + 2, y + 2, 3, 'mt'); });
      return s + '<foreignObject x="16" y="18" width="80" height="40"><canvas xmlns="http://www.w3.org/1999/xhtml" width="128" height="64" style="width:80px;height:40px;image-rendering:pixelated;display:block;background:#060c1c"></canvas></foreignObject>' + T(56, 70, 'SSD1306', 'c', 7, 'middle');
    },
    gate(def, part) {
      let s = leadL(20, 22) + leadL(52, 22) + leadR(36, 68, 90) + R(22, 16, 46, 40, 'ic') + R(22, 32, 4, 8, 'p');
      for (let i = 0; i < 4; i++) s += R(28 + i * 10, 10, 4, 6, 'mt') + R(28 + i * 10, 56, 4, 6, 'mt');
      const y = part?.settings?.out; // nível da saída Y vindo do solver
      return s + T(46, 41, 'AND', 'c', 11, 'middle') + (y === 1 ? R(76, 26, 8, 6, 'ledL on') : y === 0 ? R(76, 26, 8, 6, 'ledL') : '');
    },
    capacitor(def, part) {
      let s = leadL(34, 28) + leadR(34, 54, 82) + R(28, 8, 26, 50, 'd') + R(28, 8, 26, 4, 'l') + R(28, 54, 26, 4, 'k') + R(46, 12, 6, 42, 'p');
      const f = Math.max(0, Math.min(1, (part?.settings?.vc || 0) / 5)), h = Math.round(30 * f); // carga de 0 a 5 V
      return s + R(48, 20, 2, 4, 'd') + R(48, 30, 2, 4, 'd') + R(48, 40, 2, 4, 'd') + R(30, 14, 4, 30, 'm') + (h ? R(30, 44 - h, 4, h, 'g') : '');
    },
    diode(def, part) { return leadL(34, 24) + leadR(34, 58, 82) + R(24, 27, 34, 14, 'k') + R(26, 29, 20, 2, 'd') + R(50, 27, 4, 14, part?.settings?.lit ? 'g' : 'l'); },
    transistor(def, part) {
      const on = part?.settings?.on;
      return leadL(41, 28) + R(64, 21, 30, 2, on ? 'g' : 'mt') + R(64, 60, 30, 2, on ? 'g' : 'mt') + R(26, 26, 4, 30, 'k') + R(30, 18, 34, 46, 'k') + R(60, 18, 4, 46, on ? 'g' : 'd') + T(44, 45, 'NPN', 'c', 8, 'middle');
    },
    ldr() {
      let s = leadL(34, 30) + leadR(34, 70, 100) + disc(50, 34, 20, 'ld2') + disc(50, 34, 18, 'ld');
      return s + R(38, 22, 24, 3, 'sq') + R(59, 22, 3, 9, 'sq') + R(38, 28, 24, 3, 'sq') + R(38, 28, 3, 9, 'sq') + R(38, 34, 24, 3, 'sq') + R(59, 34, 3, 9, 'sq') + R(38, 40, 24, 3, 'sq') + R(38, 40, 3, 9, 'sq') + R(38, 46, 24, 3, 'sq');
    },
    ultrasonic() {
      let s = R(0, 17, 14, 2, 'mt') + R(0, 39, 14, 2, 'mt') + R(104, 39, 14, 2, 'mt') + R(104, 65, 14, 2, 'mt');
      s += R(12, 4, 94, 76, 'k') + R(14, 6, 90, 72, 'bp');
      [36, 82].forEach(cx => { s += disc(cx, 40, 17, 'mt2') + disc(cx, 40, 14, 'mt') + disc(cx, 40, 9, 'k'); for (let i = -6; i <= 4; i += 4) s += R(cx + i, 38, 2, 2, 'mt2') + R(cx - 1, 38 + i, 2, 2, 'mt2'); });
      return s + R(52, 10, 14, 6, 'mt') + T(59, 72, 'HC-SR04', 'c', 7, 'middle');
    },
    servo(def, part) {
      const a = (part?.settings?.angle ?? 90) - 90;
      let s = F(0, 17, 22, 2, '#6b4a2f') + F(0, 40, 22, 2, '#e25a4f') + F(74, 29, 22, 2, '#f2b44a');
      s += R(10, 32, 76, 18, 'k') + R(12, 34, 72, 14, 'bp') + R(20, 18, 56, 48, 'k') + R(22, 20, 52, 44, 'bp');
      s += `<g class="horn" transform="rotate(${a} 36 30)">${R(30, 27, 40, 6, 'c')}${disc(68, 30, 4, 'c')}${R(64, 29, 2, 2, 'm')}</g>`;
      return s + disc(36, 30, 7, 'c') + disc(36, 30, 3, 'm') + T(48, 58, 'SG90', 'c', 9, 'middle');
    },
    motor(def, part) {
      const sp = part?.settings?.speed || 0, spin = Math.abs(sp) > 0.05 ? `class="rotor spin" style="--spin:${(0.9 / Math.abs(sp)).toFixed(2)}s;--dir:${sp < 0 ? 'reverse' : 'normal'}"` : 'class="rotor"';
      return leadL(36, 16) + leadR(36, 60, 82) + R(14, 20, 8, 32, 'mt2') + R(20, 14, 42, 44, 'mt') + R(20, 22, 42, 2, 'mt2') + R(20, 48, 42, 2, 'mt2') + R(60, 18, 4, 36, 'mt2') + T(41, 41, 'M', 'k', 13, 'middle')
        + `<g ${spin}>${R(39, -2, 4, 14, 'k')}${R(32, 3, 18, 4, 'o')}</g>`;
    },
    relay(def, part) {
      let s = '';[18, 43, 68].forEach(y => { s += R(0, y - 1, 12, 2, 'mt'); });[18, 45, 70].forEach(y => { s += R(104, y - 1, 14, 2, 'mt'); });
      s += R(10, 2, 98, 86, 'k') + R(12, 4, 94, 82, 'bd') + R(24, 12, 54, 48, 'k') + R(26, 14, 50, 44, 'bp') + T(51, 34, 'RELÉ', 'c', 9, 'middle') + T(51, 46, '5V', 'p', 8, 'middle');
      s += F(82, 8, 22, 74, '#2f7a4c') + F(84, 10, 18, 70, '#3f9a63');
      [18, 45, 70].forEach(y => { s += disc(93, y, 5, 'mt') + R(90, y - 1, 7, 2, 'mt2'); });
      const on = part?.settings?.on; // LED do módulo e a lâmina do COM indo para o NO quando a bobina liga
      return s + R(28, 70, 6, 4, on ? 'ledL on' : 'ledL') + T(38, 74, 'IN', 'p', 7) + (on ? R(86, 18, 3, 28, 'o') : R(86, 18, 3, 52, 'mt2'));
    },
    rgb(def, part) {
      const [r, g, b] = part?.settings?.rgb || [0, 0, 0], lit = r + g + b > 0.02, col = `rgb(${Math.round(255 * Math.min(1, r * 1.2))},${Math.round(255 * Math.min(1, g * 1.2))},${Math.round(255 * Math.min(1, b * 1.2))})`;
      let s = leadL(18, 30) + leadL(38, 30) + leadL(58, 30) + leadR(38, 62, 92);
      s += R(36, 12, 20, 2, 'mk') + R(32, 14, 28, 2, 'mk') + R(30, 16, 32, 32, 'mk') + R(28, 48, 36, 6, 'mk2');
      if (lit) s += `<g style="filter:drop-shadow(0 0 7px ${col})">${F(32, 14, 28, 34, col)}</g>`;
      return s + F(36, 28, 5, 5, '#e25a4f') + F(44, 28, 5, 5, '#4fd06b') + F(52, 28, 5, 5, '#4a8cf0') + R(34, 18, 4, 8, 'hl');
    },
    segment(def, part) {
      let s = '';[[0, 15], [0, 34], [0, 54], [0, 74]].forEach(([, y]) => { s += R(0, y - 1, 16, 2, 'mt'); });[[96, 15], [96, 34], [96, 54], [96, 74]].forEach(([, y]) => { s += R(80, y - 1, 16, 2, 'mt'); });
      s += R(16, 4, 64, 88, 'k') + R(18, 6, 60, 84, 'ic');
      const seg = [[34, 16, 26, 4], [60, 20, 4, 22], [60, 46, 4, 22], [34, 68, 26, 4], [30, 46, 4, 22], [30, 20, 4, 22], [34, 42, 26, 4]];
      const on = part?.settings?.segs || ''; // segmentos A..G com corrente
      return s + seg.map(([x, y, w, h], i) => on.includes('ABCDEFG'[i]) ? `<g style="filter:drop-shadow(0 0 4px #ff4a3d)">${F(x, y, w, h, '#ff4a3d')}</g>` : R(x, y, w, h, 'sg')).join('') + R(68, 70, 4, 4, 'sg');
    },
    neopixel(def, part) {
      const c = part?.settings?.colors?.[0];
      let s = leadL(18, 12) + leadL(56, 12) + leadR(28, 80, 92) + leadR(52, 80, 92) + R(10, 4, 72, 68, 'k') + R(12, 6, 68, 64, 'bd');
      s += R(26, 18, 40, 40, 'mt2') + R(28, 20, 36, 36, 'c') + disc(46, 38, 12, 'p');
      if (c && c !== '#000000') return s + `<g style="filter:drop-shadow(0 0 8px ${c})">${disc(46, 38, 13, '', c)}</g>` + R(40, 32, 4, 4, 'hl');
      return s + F(40, 34, 4, 4, '#e25a4f') + F(46, 34, 4, 4, '#4fd06b') + F(43, 40, 4, 4, '#4a8cf0');
    },
    neostrip(def, part) {
      const cols = part?.settings?.colors || [];
      let s = leadL(10, 10) + leadL(22, 10) + leadL(34, 10) + leadR(22, 190, 200) + R(8, 4, 184, 36, 'k') + R(10, 6, 180, 32, 'strip');
      for (let i = 0; i < 8; i++) { const x = 16 + i * 22, c = cols[i]; s += R(x, 12, 16, 16, 'c') + R(x + 1, 13, 14, 14, 'mt');
        s += c && c !== '#000000' ? `<g style="filter:drop-shadow(0 0 6px ${c})">${F(x + 3, 15, 10, 10, c)}</g>` : R(x + 4, 16, 8, 8, 'p'); }
      return s;
    },
    dht22(def, part) { return dhtArt(def, part, '#f4f5f2', '#d8dbd2'); },
    dht11(def, part) { return dhtArt(def, part, '#3f8fd6', '#2f6fae'); },
  };
  function dhtArt(def, part, body, grille) {
    let s = [20, 40, 60, 80].map(y => leadL(y, 14)).join('') + R(12, 4, 52, 88, 'k') + F(14, 6, 48, 84, body);
    for (let y = 12; y < 62; y += 8) for (let x = 20; x < 56; x += 8) s += F(x, y, 4, 4, grille);
    return s + R(18, 70, 40, 14, 'k') + T(38, 81, esc(def.tag), 'c', 8, 'middle');
  }

  function generic(def) {
    const W = def.width, H = def.height, board = def.category === 'Placas';
    const left = def.pins.filter(p => p[1] === 0), right = def.pins.filter(p => p[1] !== 0);
    const bx = left.length ? 14 : 6, bw = W - bx - (right.length ? 14 : 6);
    let s = left.map(p => R(0, p[2] - 1, bx + 2, 2, 'mt')).join('') + right.map(p => R(bx + bw - 2, p[2] - 1, W - bx - bw + 2, 2, 'mt')).join('');
    if (def.module) { // módulo de sensor (placa roxa estilo breakout) com o chip e o nome
      s += R(bx, 2, bw, H - 4, 'k') + R(bx + 2, 4, bw - 4, H - 8, 'mod') + R(bx + bw / 2 - 12, 14, 24, 20, 'ic') + R(bx + bw / 2 - 10, 16, 4, 4, 'mt2');
      [[bx + 6, 8], [bx + bw - 10, 8], [bx + 6, H - 12], [bx + bw - 10, H - 12]].forEach(([x, y]) => { s += R(x, y, 4, 4, 'mt'); });
      return s + T(bx + bw / 2, H - 16, esc(String(def.tag).slice(0, 8)), 'c', 9, 'middle');
    }
    if (board) {
      s += R(bx, 2, bw, H - 4, 'k') + R(bx + 2, 4, bw - 4, H - 8, 'bd');
      s += R(bx + bw / 2 - 26, 10, 52, H - 26, 'mt2') + R(bx + bw / 2 - 24, 12, 48, H - 30, 'mt');
      s += R(bx + 6, H - 14, 8, 6, 'g') + T(bx + bw / 2, H / 2 + 2, esc(String(def.tag || 'MCU').slice(0, 7)), 'k', 12, 'middle');
    } else {
      s += R(bx, 4, bw, H - 8, 'ic') + R(bx, H / 2 - 4, 4, 8, 'p') + R(bx + 6, 8, 4, 4, 'mt2');
      s += T(bx + bw / 2, H / 2 + 4, esc(String(def.tag || def.name || 'IC').slice(0, 8)), 'c', 11, 'middle');
    }
    return s;
  }

  function svg(def, part, cls) {
    let body = ART[def.type] ? ART[def.type](def, part || {}) : generic(def);
    const warn = part?.settings?.warn; if (warn) body += `<g class="px-warn"><title>${esc(warn)}</title>${F(def.width - 14, 0, 14, 14, '#e5484d')}${T(def.width - 7, 11, '!', 'c', 11, 'middle')}</g>`;
    return `<svg class="px-art ${cls || ''}" viewBox="0 0 ${def.width} ${def.height}" width="${def.width}" height="${def.height}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  }
  window.PixelParts = { art: (def, part) => svg(def, part), thumb: def => svg(def, { settings: {} }, 'px-thumb') };
})();
