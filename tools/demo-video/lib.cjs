// Recorder v2: CDP screencast + overlay na arte do site (pixel wipe, câmera, legendas curtas) + log de efeitos sonoros.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:8080';
const VIEW = { width: 1600, height: 900 };
const COLS = 16, ROWS = 9;

const OVERLAY = `(() => {
  if (window.__demo) return;
  const css = \`
  @font-face{font-family:DemoPixel;src:url('/assets/fonts/pixelify-sans.woff') format('woff');font-weight:400 700}
  #demo-root{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
  #demo-cursor{position:fixed;left:0;top:0;width:30px;height:30px;transform:translate(-4px,-3px);filter:drop-shadow(3px 3px 0 rgba(24,36,73,.35));opacity:0;transition:opacity .2s}
  #demo-cursor.down{transform:translate(-4px,-3px) scale(.82)}
  .demo-ring{position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border:3px solid #7941b7;animation:dRing .5s steps(5) forwards}
  @keyframes dRing{to{transform:scale(4);opacity:0}}
  #demo-cap{position:fixed;left:40px;bottom:40px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;transform-origin:left bottom}
  #demo-cap.dc-right{left:auto;right:40px;align-items:flex-end;transform-origin:right bottom}
  #demo-cap.dc-top{bottom:auto;top:40px}
  #demo-cap .k{font:700 13px ui-monospace,monospace;letter-spacing:.2em;background:#315acb;color:#fff;padding:6px 10px;box-shadow:3px 3px 0 #182449}
  #demo-cap .t{font:700 44px/1 DemoPixel,monospace;color:#182449;background:#f4f7ff;border:3px solid #182449;padding:12px 18px 14px;box-shadow:7px 7px 0 #7941b7}
  #demo-cap .t b{color:#7941b7}
  #demo-cap>*{opacity:0;transform:translateY(20px) scale(.7)}
  #demo-cap.show>*{animation:dPop .5s cubic-bezier(.2,1.7,.4,1) forwards}
  #demo-cap.show>.t{animation-delay:.07s}
  #demo-cap.hide>*{animation:dOut .25s ease-in forwards}
  @keyframes dPop{to{opacity:1;transform:none}}
  @keyframes dOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.9)}}
  #demo-wipe{position:fixed;inset:0;display:grid;grid-template-columns:repeat(${COLS},1fr);grid-template-rows:repeat(${ROWS},1fr)}
  #demo-wipe i{display:block;background:#182449;transform:scale(0);margin:-1px}
  #demo-wipe i.a{background:#315acb}#demo-wipe i.b{background:#7941b7}#demo-wipe i.c{background:#65d9ef}
  #demo-wipe.covered i{transform:scale(1)}
  #demo-wipe.covered i.a,#demo-wipe.covered i.b,#demo-wipe.covered i.c{background:#182449}
  #demo-title{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#f4f7ff;text-align:center}
  #demo-title .n{font:700 22px ui-monospace,monospace;letter-spacing:.4em;color:#65d9ef}
  #demo-title .t{font:700 120px/1 DemoPixel,monospace;letter-spacing:-2px}
  #demo-title .t b{color:#c1a4ff}
  #demo-title .s{font:500 24px system-ui,sans-serif;color:#b1bedb}
  #demo-title>*{opacity:0;transform:scale(.6) translateY(30px)}
  #demo-title.show>*{animation:dPop .6s cubic-bezier(.2,1.6,.4,1) forwards}
  #demo-title.show>.t{animation-delay:.08s}#demo-title.show>.s{animation-delay:.18s}
  #demo-title.hide>*{animation:dOut .2s ease-in forwards}
  \`;
  let root;
  const init = () => {
    if (document.getElementById('demo-root')) return;
    const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);
    root = document.createElement('div'); root.id = 'demo-root';
    let cells = ''; for (let r = 0; r < ${ROWS}; r++) for (let c = 0; c < ${COLS}; c++) { const k = (r * 7 + c * 3) % 11; cells += '<i data-d="' + (r + c) + '" class="' + (k === 0 ? 'a' : k === 4 ? 'b' : k === 8 ? 'c' : '') + '"></i>'; }
    root.innerHTML = '<div id="demo-wipe">' + cells + '</div><div id="demo-title"><div class="n"></div><div class="t"></div><div class="s"></div></div><div id="demo-cap"><div class="k"></div><div class="t"></div></div><svg id="demo-cursor" viewBox="0 0 24 24"><path d="M3 2h2v2h2v2h2v2h2v2h2v2h2v2h-5v2h1v2h1v2h-2v1h-2v-2h-1v-2h-1v-2H5v2H3z" fill="#182449" stroke="#f4f7ff" stroke-width="1.3" shape-rendering="crispEdges"/></svg>';
    document.documentElement.appendChild(root);
    if (window.name === 'demo-cover') { root.querySelector('#demo-wipe').classList.add('covered'); }
    const cur = root.querySelector('#demo-cursor');
    addEventListener('mousemove', e => { cur.style.opacity = 1; cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => { cur.classList.add('down'); const r = document.createElement('div'); r.className = 'demo-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; root.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
    if (window.__demoCursor) { cur.style.opacity = 1; cur.style.left = window.__demoCursor[0] + 'px'; cur.style.top = window.__demoCursor[1] + 'px'; }
    // efeitos do próprio site -> trilha sonora
    const fx = () => { const layer = document.getElementById('mx-fx'); if (!layer) return setTimeout(fx, 300);
      if (layer.parentNode !== document.documentElement) document.documentElement.insertBefore(layer, root);
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('coin')) window.__demoSfx && window.__demoSfx(/★/.test(n.textContent) ? 'win' : 'coin'); }))).observe(layer, { childList: true }); };
    fx();
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('mx-flash')) window.__demoSfx && window.__demoSfx('boom'); }))).observe(document.body, { childList: true, subtree: true });
  };
  const cells = () => [...document.querySelectorAll('#demo-wipe i')];
  window.__demo = {
    init,
    async cover(dur = 520) { init(); const w = document.getElementById('demo-wipe'); const max = ${ROWS + COLS - 2};
      const anims = cells().map(c => c.animate([{ transform: 'scale(0) rotate(45deg)' }, { transform: 'scale(1.08) rotate(0)' }, { transform: 'scale(1)' }], { duration: dur * .55, delay: (+c.dataset.d / max) * dur * .45, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'both' }));
      await Promise.all(anims.map(a => a.finished)); w.classList.add('covered'); anims.forEach(a => a.cancel()); },
    async uncover(dur = 560) { init(); const w = document.getElementById('demo-wipe'); const max = ${ROWS + COLS - 2}; w.classList.remove('covered');
      const anims = cells().map(c => c.animate([{ transform: 'scale(1)' }, { transform: 'scale(0) rotate(-45deg)' }], { duration: dur * .5, delay: ((max - +c.dataset.d) / max) * dur * .5, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'both' }));
      await Promise.all(anims.map(a => a.finished)); anims.forEach(a => a.cancel()); },
    title(n, t, s) { init(); const el = document.getElementById('demo-title'); el.className = ''; el.querySelector('.n').textContent = n || ''; el.querySelector('.t').innerHTML = t || ''; el.querySelector('.s').textContent = s || ''; void el.offsetWidth; el.classList.add('show'); },
    titleOff() { const el = document.getElementById('demo-title'); if (el) { el.classList.remove('show'); el.classList.add('hide'); } },
    caption(k, t, pos) { init(); const c = document.getElementById('demo-cap'); c.className = (pos || '').split(' ').filter(Boolean).map(x => 'dc-' + x).join(' ');
      c.querySelector('.k').textContent = k || ''; c.querySelector('.k').style.display = k ? '' : 'none'; c.querySelector('.t').innerHTML = t || ''; void c.offsetWidth; c.classList.add('show'); },
    hide() { const c = document.getElementById('demo-cap'); if (c && c.classList.contains('show')) { c.classList.remove('show'); c.classList.add('hide'); } },
    cam(sel, fx, fy, scale, ms) { const b = document.body, el = document.querySelector(sel); const prev = b.style.transform;
      b.style.transition = 'none'; b.style.transform = 'none'; const r = el.getBoundingClientRect();
      const px = r.left + r.width * fx + scrollX, py = r.top + r.height * fy + scrollY;
      b.style.transform = prev; void b.offsetWidth;
      const tx = innerWidth / 2 + scrollX - scale * px, ty = innerHeight / 2 + scrollY - scale * py;
      b.style.transformOrigin = '0 0'; b.style.transition = 'transform ' + ms + 'ms cubic-bezier(.65,0,.3,1)';
      b.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; },
    camReset(ms) { const b = document.body; b.style.transition = 'transform ' + ms + 'ms cubic-bezier(.65,0,.3,1)'; b.style.transform = 'none'; },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();`;

class Recorder {
  constructor(name, outDir) { this.name = name; this.outDir = outDir; this.frames = []; this.events = []; this.dir = path.join(outDir, 'frames-' + name); }
  sfx(type) { if (this.cdp && !this.stopped) this.events.push({ type, t: Date.now() / 1000 }); }
  async start(page) {
    fs.rmSync(this.dir, { recursive: true, force: true }); fs.mkdirSync(this.dir, { recursive: true });
    this.cdp = await page.context().newCDPSession(page); let i = 0;
    this.cdp.on('Page.screencastFrame', async f => {
      if (this.stopped) return;
      const file = path.join(this.dir, String(i++).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(f.data, 'base64')); this.frames.push({ file, t: f.metadata.timestamp });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  }
  async stop() {
    await new Promise(r => setTimeout(r, 250));
    await this.cdp.send('Page.stopScreencast').catch(() => {}); this.stopped = true;
    const end = Date.now() / 1000, fr = this.frames.sort((a, b) => a.t - b.t), t0 = fr[0].t;
    const lines = ['ffconcat version 1.0'];
    fr.forEach((f, k) => lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, (k + 1 < fr.length ? fr[k + 1].t : end) - f.t).toFixed(4)}`));
    lines.push(`file '${fr[fr.length - 1].file}'`);
    const list = path.join(this.dir, 'list.txt'); fs.writeFileSync(list, lines.join('\n'));
    const out = path.join(this.outDir, this.name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', out]);
    fs.writeFileSync(path.join(this.outDir, this.name + '.sfx.json'), JSON.stringify({ duration: end - t0, events: this.events.map(e => ({ type: e.type, t: +(e.t - t0).toFixed(3) })).filter(e => e.t >= 0) }));
    fs.rmSync(this.dir, { recursive: true, force: true });
    return { out, seconds: end - t0, events: this.events.length };
  }
}

async function setup(rec) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1.2, colorScheme: 'light', locale: 'pt-BR' });
  await context.exposeBinding('__demoSfx', (_src, type) => rec.sfx(type));
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  return { browser, context, page, D: makeDriver(page, rec) };
}

function makeDriver(page, rec) {
  let cx = 1500, cy = 820;
  const wait = ms => page.waitForTimeout(ms);
  const ev = (fn, ...a) => page.evaluate(([f, args]) => window.__demo[f](...args), [fn, a]);
  async function moveTo(x, y, steps) {
    const dist = Math.hypot(x - cx, y - cy); steps = steps || Math.max(8, Math.min(26, Math.round(dist / 28)));
    for (let i = 1; i <= steps; i++) { const p = i / steps, e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      await page.mouse.move(cx + (x - cx) * e, cy + (y - cy) * e); await wait(11); }
    cx = x; cy = y; await page.evaluate(([a, b]) => { window.__demoCursor = [a, b]; }, [x, y]).catch(() => {});
  }
  async function center(sel) {
    const r = await page.evaluate(q => { const el = document.querySelector(q); if (!el) return null; const b = el.getBoundingClientRect();
      return (b.width && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth) ? [b.x + b.width / 2, b.y + b.height / 2] : null; }, sel).catch(() => null);
    if (r) return r;
    const loc = page.locator(sel).first(); await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (!b) throw new Error('no box ' + sel);
    return [b.x + b.width / 2, b.y + b.height / 2];
  }
  const D = {
    page, wait, moveTo, center, sfx: t => rec.sfx(t),
    async goto(url, { covered = false } = {}) {
      await page.evaluate(c => { window.name = c ? 'demo-cover' : ''; }, covered).catch(() => {});
      await page.goto(url.startsWith('http') ? url : BASE + url, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => window.__demo && window.__demo.init());
      await page.evaluate(() => { window.name = ''; });
      await page.mouse.move(cx, cy);
    },
    async cover(ms) { rec.sfx('whoosh'); await ev('cover', ms); },
    async uncover(ms) { rec.sfx('whoosh'); await ev('uncover', ms); },
    async title(n, t, s, hold = 1600) { rec.sfx('title'); await ev('title', n, t, s); await wait(hold); await ev('titleOff'); await wait(200); },
    async caption(k, t, pos) { rec.sfx('tick'); await ev('caption', k, t, pos); },
    hide: () => ev('hide'),
    async cam(sel, scale = 1.5, ms = 900, fx = .5, fy = .5) { rec.sfx('zoom'); await ev('cam', sel, fx, fy, scale, ms); await wait(ms); },
    async camReset(ms = 800) { await ev('camReset', ms); await wait(ms); },
    async hover(sel, ms = 200) { const [x, y] = await center(sel); await moveTo(x, y); await wait(ms); },
    async click(sel, ms = 300) {
      const vis = await page.evaluate(q => { const el = document.querySelector(q); if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; }, sel);
      const zoomed = await page.evaluate(() => !!document.body.style.transform && document.body.style.transform !== 'none');
      if (!vis && zoomed) { rec.sfx('click'); await page.evaluate(q => document.querySelector(q).click(), sel); await wait(ms); return; }
      const [x, y] = await center(sel); await moveTo(x, y); await wait(70); rec.sfx('click'); await page.mouse.down(); await wait(55); await page.mouse.up(); await wait(ms); },
    async scrollTo(sel, block = 'center', ms = 900) { await page.locator(sel).first().evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block); await wait(ms); },
    async drag(sel, dx, dy) { const [x, y] = await center(sel); await moveTo(x, y); await page.mouse.down(); await wait(60); await moveTo(x + dx, y + dy, 16); await page.mouse.up(); await wait(150); },
  };
  return D;
}

module.exports = { setup, Recorder, BASE };
