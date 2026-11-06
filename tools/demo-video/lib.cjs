// Demo recorder: CDP screencast (sharp JPEG frames) + in-page presentation overlay.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:8080';
const VIEW = { width: 1600, height: 900 };
const DSF = 1.2; // 1920x1080 frames

const OVERLAY = `(() => {
  if (window.__demo) return;
  const css = \`
  @font-face{font-family:DemoPixel;src:url('/assets/fonts/pixelify-sans.woff') format('woff');font-weight:400 700}
  #demo-root{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,sans-serif}
  #demo-cursor{position:fixed;left:0;top:0;width:30px;height:30px;transform:translate(-4px,-3px);transition:opacity .3s;filter:drop-shadow(2px 3px 2px rgba(0,0,0,.35));opacity:0}
  .demo-ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #7a3fd0;animation:demoRipple .6s ease-out forwards}
  @keyframes demoRipple{to{transform:scale(4.2);opacity:0}}
  #demo-cap{position:fixed;left:34px;bottom:34px;max-width:620px;background:rgba(20,26,58,.94);color:#f4f1e7;padding:18px 24px 20px;border-left:6px solid #d6ed83;box-shadow:8px 8px 0 rgba(122,63,208,.85);transform:translateY(30px);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .35s}
  #demo-cap.show{transform:none;opacity:1}
  #demo-cap.dc-right{left:auto;right:34px}
  #demo-cap.dc-top{bottom:auto;top:34px}
  #demo-cap.dc-canvas{left:352px;bottom:70px}
  #demo-cap .k{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#d6ed83;text-transform:uppercase}
  #demo-cap .t{font:700 31px/1.15 DemoPixel,monospace;margin:9px 0 6px}
  #demo-cap .s{font:15px/1.45 system-ui,sans-serif;color:#cdd3ee}
  #demo-cap .t b{color:#d6ed83;font-weight:700}
  #demo-chapter{position:fixed;inset:0;background:#141a3a;color:#f4f1e7;display:flex;flex-direction:column;justify-content:center;padding:0 140px;opacity:0;transition:opacity .45s;background-image:linear-gradient(rgba(214,237,131,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(214,237,131,.06) 1px,transparent 1px);background-size:40px 40px}
  #demo-chapter.show{opacity:1}
  #demo-chapter .t b{color:#d6ed83;font-weight:700}
  #demo-root.chap #demo-cursor{opacity:0!important}
  #demo-chapter .n{font:700 150px/1 DemoPixel,monospace;color:#7a3fd0;text-shadow:6px 6px 0 #d6ed83;transform:translateX(-60px);opacity:0;transition:all .6s .1s cubic-bezier(.2,.9,.3,1.2)}
  #demo-chapter .k{font:600 15px/1 ui-monospace,monospace;letter-spacing:.3em;color:#d6ed83;margin-top:26px;opacity:0;transition:opacity .5s .3s}
  #demo-chapter .t{font:700 74px/1.05 DemoPixel,monospace;margin:18px 0;max-width:1200px;transform:translateY(30px);opacity:0;transition:all .6s .25s cubic-bezier(.2,.9,.3,1.2)}
  #demo-chapter .s{font:22px/1.5 system-ui,sans-serif;color:#b9c0e3;max-width:1000px;opacity:0;transition:opacity .6s .5s}
  #demo-chapter.show .n,#demo-chapter.show .t{transform:none;opacity:1}
  #demo-chapter.show .k,#demo-chapter.show .s{opacity:1}
  #demo-chapter .bar{position:absolute;left:140px;bottom:110px;height:8px;background:#d6ed83;width:0;transition:width 2.2s .3s linear}
  #demo-chapter.show .bar{width:calc(100% - 280px)}
  #demo-chapter .chips{display:flex;gap:12px;margin-top:22px;opacity:0;transition:opacity .6s .7s}
  #demo-chapter.show .chips{opacity:1}
  #demo-chapter .chips span{font:600 14px ui-monospace,monospace;border:2px solid #7a3fd0;padding:8px 12px;color:#e5e3ff}
  .demo-spot{position:fixed;border:3px solid #7a3fd0;box-shadow:0 0 0 4px rgba(214,237,131,.8),0 0 0 9999px rgba(10,14,40,.28);transition:all .45s cubic-bezier(.2,.9,.3,1.1);border-radius:6px;opacity:0}
  .demo-spot.show{opacity:1}
  #demo-badge{position:fixed;right:28px;top:22px;font:600 12px ui-monospace,monospace;letter-spacing:.14em;background:#141a3a;color:#d6ed83;padding:8px 12px;opacity:0;transition:opacity .4s}
  #demo-badge.show{opacity:.92}
  #demo-badge i{display:inline-block;width:8px;height:8px;background:#ff5d5d;margin-right:8px;animation:demoBlink 1s steps(2) infinite}
  @keyframes demoBlink{50%{opacity:0}}
  \`;
  const init = () => {
    if (document.getElementById('demo-root')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'demo-root';
    root.innerHTML = '<div id="demo-chapter"><div class="n"></div><div class="k"></div><div class="t"></div><div class="s"></div><div class="chips"></div><div class="bar"></div></div><div class="demo-spot"></div><div id="demo-cap"><div class="k"></div><div class="t"></div><div class="s"></div></div><div id="demo-badge"><i></i><span></span></div><svg id="demo-cursor" viewBox="0 0 24 24"><path d="M3 2l15 9-6.5 1.6L15 20l-3 1.4-3.4-7.3L3 19z" fill="#141a3a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(root);
    const cur = root.querySelector('#demo-cursor');
    addEventListener('mousemove', e => { cur.style.opacity = 1; cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = 'demo-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; root.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
    if (window.__demoCursor) { cur.style.opacity = 1; cur.style.left = window.__demoCursor[0] + 'px'; cur.style.top = window.__demoCursor[1] + 'px'; }
  };
  window.__demo = {
    caption(k, t, s, pos) { init(); const c = document.getElementById('demo-cap'); c.className = (pos || '').split(' ').filter(Boolean).map(x => 'dc-' + x).join(' ');
      c.querySelector('.k').textContent = k || ''; c.querySelector('.t').innerHTML = t || ''; c.querySelector('.s').textContent = s || '';
      requestAnimationFrame(() => c.classList.add('show')); },
    hide() { const c = document.getElementById('demo-cap'); if (c) c.classList.remove('show'); },
    chapter(n, k, t, s, chips) { init(); const c = document.getElementById('demo-chapter'); c.classList.remove('show');
      c.querySelector('.n').textContent = n; c.querySelector('.k').textContent = k; c.querySelector('.t').innerHTML = t; c.querySelector('.s').textContent = s || '';
      c.querySelector('.chips').innerHTML = (chips || []).map(x => '<span>' + x + '</span>').join('');
      void c.offsetWidth; c.classList.add('show'); document.getElementById('demo-root').classList.add('chap'); },
    chapterOff() { const c = document.getElementById('demo-chapter'); if (c) c.classList.remove('show'); const r = document.getElementById('demo-root'); if (r) r.classList.remove('chap'); },
    spot(sel, pad) { init(); const s = document.querySelector('.demo-spot'); const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return;
      const r = el.getBoundingClientRect(); pad = pad ?? 8; Object.assign(s.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' }); s.classList.add('show'); },
    spotOff() { const s = document.querySelector('.demo-spot'); if (s) s.classList.remove('show'); },
    badge(text) { init(); const b = document.getElementById('demo-badge'); b.querySelector('span').textContent = text; b.classList.add('show'); },
    init,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();`;

class Recorder {
  constructor(name, outDir) { this.name = name; this.outDir = outDir; this.frames = []; this.dir = path.join(outDir, 'frames-' + name); }
  async start(page) {
    fs.rmSync(this.dir, { recursive: true, force: true }); fs.mkdirSync(this.dir, { recursive: true });
    this.page = page; this.cdp = await page.context().newCDPSession(page); let i = 0;
    this.cdp.on('Page.screencastFrame', async f => {
      if (this.stopped) return;
      const file = path.join(this.dir, String(i++).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.t0 = Date.now() / 1000;
  }
  async stop() {
    await new Promise(r => setTimeout(r, 300));
    await this.cdp.send('Page.stopScreencast').catch(() => {}); this.stopped = true;
    const end = Date.now() / 1000;
    const fr = this.frames.sort((a, b) => a.t - b.t);
    const lines = ['ffconcat version 1.0'];
    for (let k = 0; k < fr.length; k++) {
      const d = (k + 1 < fr.length ? fr[k + 1].t : end) - fr[k].t;
      lines.push(`file '${fr[k].file}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
    }
    lines.push(`file '${fr[fr.length - 1].file}'`);
    const list = path.join(this.dir, 'list.txt'); fs.writeFileSync(list, lines.join('\n'));
    const out = path.join(this.outDir, this.name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', out]);
    fs.rmSync(this.dir, { recursive: true, force: true });
    return { out, frames: fr.length, seconds: end - fr[0].t };
  }
}

async function setup() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, colorScheme: 'light', locale: 'pt-BR', acceptDownloads: true });
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  const D = makeDriver(page);
  return { browser, context, page, D };
}

function makeDriver(page) {
  let cx = 800, cy = 450;
  const wait = ms => page.waitForTimeout(ms);
  const ev = (fn, ...a) => page.evaluate(([f, args]) => window.__demo[f](...args), [fn, a]);
  async function moveTo(x, y, steps) {
    const dist = Math.hypot(x - cx, y - cy); steps = steps || Math.max(12, Math.min(45, Math.round(dist / 18)));
    for (let i = 1; i <= steps; i++) { const p = i / steps, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      await page.mouse.move(cx + (x - cx) * e, cy + (y - cy) * e); await wait(12); }
    cx = x; cy = y; await page.evaluate(([a, b]) => { window.__demoCursor = [a, b]; }, [x, y]);
  }
  async function center(sel) {
    if (typeof sel === 'string') {
      const r = await page.evaluate(q => { const el = document.querySelector(q); if (!el) return null; const b = el.getBoundingClientRect();
        return (b.width && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth) ? [b.x + b.width / 2, b.y + b.height / 2] : null; }, sel).catch(() => null);
      if (r) return r;
    }
    const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
    await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (!b) throw new Error('no box ' + sel);
    return [b.x + b.width / 2, b.y + b.height / 2];
  }
  return {
    page, wait,
    async goto(url) { await page.goto(BASE + url); await page.waitForLoadState('networkidle'); await page.evaluate(() => window.__demo && window.__demo.init()); await page.mouse.move(cx, cy); },
    caption: (k, t, s, pos) => ev('caption', k, t, s, pos),
    hide: () => ev('hide'),
    async chapter(n, k, t, s, chips, ms = 3200) { await ev('chapter', n, k, t, s, chips); await wait(ms); await ev('chapterOff'); await wait(500); },
    chapterOn: (n, k, t, s, chips) => ev('chapter', n, k, t, s, chips),
    chapterOff: () => ev('chapterOff'),
    spot: (sel, pad) => ev('spot', sel, pad),
    spotOff: () => ev('spotOff'),
    badge: t => ev('badge', t),
    moveTo, center,
    async hover(sel, ms = 300) { const [x, y] = await center(sel); await moveTo(x, y); await wait(ms); },
    async click(sel, ms = 450) { const [x, y] = await center(sel); await moveTo(x, y); await wait(140); await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(ms); },
    async clickAt(x, y, ms = 400) { await moveTo(x, y); await wait(120); await page.mouse.down(); await wait(60); await page.mouse.up(); await wait(ms); },
    async drag(sel, dx, dy) { const [x, y] = await center(sel); await moveTo(x, y); await page.mouse.down(); await wait(80);
      await moveTo(x + dx, y + dy, 28); await page.mouse.up(); await wait(250); },
    async type(sel, text, delay = 55) { await this.click(sel, 150); await page.locator(sel).first().fill(''); await page.keyboard.type(text, { delay }); },
    async scroll(dy, steps = 30) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await wait(16); } await wait(300); },
    async scrollTo(sel, block = 'center') { await page.locator(sel).first().evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block); await wait(900); },
  };
}

module.exports = { setup, Recorder, BASE };
