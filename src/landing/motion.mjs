// Movimento e pequenas recompensas da oficina. Não altera o modelo elétrico: só observa a interface.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const on = () => !reduce.matches && !document.body.classList.contains('no-motion');
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const root = document.documentElement;
if (!reduce.matches) root.classList.add('mx');

const fx = document.createElement('div'); fx.id = 'mx-fx'; fx.setAttribute('aria-hidden', 'true'); document.body.append(fx);
const tokens = () => { const cs = getComputedStyle(root); return ['--accent', '--accent2', '--warning', '--danger', '--ink'].map(v => cs.getPropertyValue(v).trim() || '#315acb'); };
const rand = (a, b) => a + Math.random() * (b - a);
const buzz = p => { try { navigator.vibrate?.(p); } catch {} };

// --- efeitos básicos ---------------------------------------------------------
function burst(x, y, { n = 16, spread = 120, size = [5, 10], colors = tokens(), gravity = 90, life = 750 } = {}) {
  if (!on()) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.className = 'px';
    const s = Math.round(rand(size[0], size[1])); p.style.width = p.style.height = s + 'px'; p.style.background = colors[i % colors.length];
    fx.append(p);
    const a = rand(0, Math.PI * 2), d = rand(spread * .35, spread), dx = Math.cos(a) * d, dy = Math.sin(a) * d - spread * .25;
    const t = life * rand(.7, 1.25), r = rand(-200, 200);
    p.animate([
      { transform: `translate(${x}px,${y}px) rotate(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${x + dx * .7}px,${y + dy * .7}px) rotate(${r * .6}deg) scale(1)`, opacity: 1, offset: .55 },
      { transform: `translate(${x + dx}px,${y + dy + gravity}px) rotate(${r}deg) scale(.4)`, opacity: 0 },
    ], { duration: t, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => p.remove();
  }
}
function coin(text, x, y) {
  if (!on()) return;
  const c = document.createElement('span'); c.className = 'coin'; c.textContent = text; fx.append(c);
  const w = c.offsetWidth; const left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2));
  c.animate([
    { transform: `translate(${left}px,${y}px) scale(.4)`, opacity: 0 },
    { transform: `translate(${left}px,${y - 34}px) scale(1.12)`, opacity: 1, offset: .2 },
    { transform: `translate(${left}px,${y - 46}px) scale(1)`, opacity: 1, offset: .75 },
    { transform: `translate(${left}px,${y - 80}px) scale(.9)`, opacity: 0 },
  ], { duration: 1500, easing: 'cubic-bezier(.2,1,.3,1)' }).onfinish = () => c.remove();
}
function press(el) {
  if (!on() || !el) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9,.86)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
function confetti(rect, n = 90) {
  if (!on()) return;
  const colors = tokens();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.className = 'px'; const s = Math.round(rand(5, 11));
    p.style.width = s + 'px'; p.style.height = Math.round(s * rand(.6, 1.4)) + 'px'; p.style.background = colors[i % 4]; fx.append(p);
    const x = rand(rect.left, rect.right), y0 = rect.top - rand(10, 120), y1 = rect.bottom + rand(-40, 60), sway = rand(-60, 60);
    p.animate([
      { transform: `translate(${x}px,${y0}px) rotate(0)`, opacity: 1 },
      { transform: `translate(${x + sway}px,${(y0 + y1) / 2}px) rotate(${rand(180, 540)}deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${x - sway / 2}px,${y1}px) rotate(${rand(540, 900)}deg)`, opacity: 0 },
    ], { duration: rand(1300, 2400), delay: rand(0, 500), easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'backwards' }).onfinish = () => p.remove();
  }
}
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const atCanvas = (fx_, fy) => { const r = $('#workshopCanvas').getBoundingClientRect(); return [r.left + r.width * fx_, r.top + r.height * fy]; };

// --- título em palavras -------------------------------------------------------
(function splitTitle() {
  const h1 = $('.hero h1'); if (!h1) return; let i = 0;
  [...h1.childNodes].forEach(node => {
    if (node.nodeType !== 3 || !node.textContent.trim()) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach(part => {
      if (!part) return; if (/^\s+$/.test(part)) { frag.append(part); return; }
      const w = document.createElement('span'); w.className = 'mx-word'; w.style.setProperty('--i', i++); w.textContent = part; frag.append(w);
    });
    node.replaceWith(frag);
  });
})();
$$('.site-header nav a, .site-header>.button').forEach((el, i) => el.style.setProperty('--i', i));
$$('.hero-actions>*').forEach((el, i) => el.style.setProperty('--i', i));
$$('.scenario-buttons button').forEach((el, i) => el.style.setProperty('--i', i));

// --- descobertas ---------------------------------------------------------------
const QUEST = [
  ['calm', 'Carga tranquila'], ['over', 'Sobretensão'], ['boom', 'Ruptura didática'], ['fix', 'Peça trocada'], ['hi', 'Oi, robô!'],
];
const found = new Set();
const quest = document.createElement('div'); quest.className = 'mx-quest'; quest.style.setProperty('--i', 2);
quest.innerHTML = `<span>DESCOBERTAS</span><span class="mx-quest-bar">${QUEST.map(([id, label]) => `<i data-q="${id}" title="${label}"></i>`).join('')}</span><b>0/${QUEST.length}</b><span class="mx-quest-hint" aria-live="polite">Mude a tensão e veja o que acontece.</span><a href="./studio.html">Abrir a bancada ↗</a>`;
$('.live-readings')?.after(quest);
$('.live-readings')?.style.setProperty('--i', 1);
const nextHint = { calm: 'Mude a tensão.', over: 'Agora tente 32 V.', boom: 'Coragem: aperte 100×.', fix: 'Troque a peça no ↻.', hi: 'Dê um oi para o robô.' };
function unlock(id, from) {
  if (found.has(id)) return; found.add(id);
  const label = QUEST.find(q => q[0] === id)[1];
  const cell = quest.querySelector(`[data-q="${id}"]`); cell.classList.add('on');
  const count = quest.querySelector('b'); count.textContent = `${found.size}/${QUEST.length}`; count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
  const [cx, cy] = center(cell); burst(cx, cy, { n: 12, spread: 60, size: [4, 7] });
  const [x, y] = from ? center(from) : [cx, cy]; coin(`+1 ✦ ${label}`, x, y - 10); buzz(12);
  const pending = QUEST.find(q => !found.has(q[0]));
  quest.querySelector('.mx-quest-hint').textContent = pending ? nextHint[pending[0]] : 'Oficina completa! Bora para a bancada?';
  if (!pending) celebrate();
}
function celebrate() {
  quest.classList.add('done'); buzz([12, 50, 12, 50, 30]);
  const scene = $('.scene'); if (!scene) return;
  setTimeout(() => { confetti(scene.getBoundingClientRect()); const [x, y] = center(quest.querySelector('b')); coin('★ OFICINA COMPLETA', x, y - 20); $('.robot-wave')?.click(); }, 350);
}

// cliques nos cenários e na troca de peça
$$('[data-scenario]').forEach(b => b.addEventListener('click', () => {
  press(b); const [x, y] = center(b); burst(x, y, { n: b.dataset.scenario === 'extreme' ? 22 : 14 }); buzz(8);
  if (b.dataset.scenario === 'nominal') unlock('calm', b);
  if (b.dataset.scenario === 'overvoltage') unlock('over', b);
}));
$('#restore')?.addEventListener('click', e => {
  const b = e.currentTarget; press(b); b.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-360deg)' }], { duration: 500, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  const [x, y] = center(b); burst(x, y, { n: 10, spread: 70 });
  if (found.has('boom')) unlock('fix', b);
});
$('.robot-wave')?.addEventListener('click', () => { const [x, y] = atCanvas(.22, .74); burst(x, y, { n: 10, spread: 70, size: [4, 7] }); unlock('hi', $('.robot-wave')); });
// a primeira carga já conta: recompensa logo no começo
setTimeout(() => { if (!found.has('calm')) unlock('calm', $('[data-scenario=nominal]')); }, reduce.matches ? 0 : 2600);

// estados do circuito vindos da animação principal
const badge = $('#sceneBadge'); let lastState = '';
new MutationObserver(() => {
  const failed = badge.classList.contains('failed'), hot = /LIMITE/.test(badge.textContent);
  const state = failed ? 'failed' : hot ? 'hot' : 'ok'; if (state === lastState) return; lastState = state;
  const scene = $('.scene');
  if (failed) {
    if (on()) { scene.classList.remove('mx-shake'); void scene.offsetWidth; scene.classList.add('mx-shake');
      const f = document.createElement('div'); f.className = 'mx-flash'; scene.append(f); setTimeout(() => f.remove(), 500);
      const [x, y] = atCanvas(.78, .42); burst(x, y, { n: 34, spread: 190, size: [5, 12], gravity: 140, life: 1000 }); buzz([30, 30, 60]); }
    unlock('boom', $('[data-scenario=extreme]'));
  } else if (hot && on()) {
    scene.classList.remove('mx-wobble'); void scene.offsetWidth; scene.classList.add('mx-wobble');
    const r = $('.live-readings'); r.classList.remove('mx-hot'); void r.offsetWidth; r.classList.add('mx-hot');
  }
}).observe(badge, { attributes: true, childList: true, subtree: true, characterData: true });

// faíscas leves ao passar o mouse sobre a oficina
let lastSpark = 0;
$('.scene')?.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || !on() || e.timeStamp - lastSpark < 70) return; lastSpark = e.timeStamp;
  burst(e.clientX, e.clientY, { n: 2, spread: 22, size: [3, 5], gravity: 18, life: 500 });
});

// botões em geral: um pequeno "pop"
document.addEventListener('click', e => {
  const b = e.target.closest('.button, [data-theme-choice], [data-vision-trigger], #motionToggle'); if (!b) return;
  press(b); const [x, y] = [e.clientX || center(b)[0], e.clientY || center(b)[1]]; burst(x, y, { n: 8, spread: 55, size: [3, 6] });
});

// --- cartuchos: inclinação e encaixe --------------------------------------------
$$('.cartridge').forEach((card, i) => {
  card.classList.add('mx-reveal'); card.style.setProperty('--i', i);
  card.addEventListener('pointermove', e => {
    if (!on() || e.pointerType !== 'mouse') return; const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', px * 100 + '%'); card.style.setProperty('--my', py * 100 + '%');
    card.style.transform = `translateY(-8px) rotateX(${(.5 - py) * 10}deg) rotateY(${(px - .5) * 12}deg)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  card.addEventListener('click', e => {
    if (!on() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); card.style.transform = ''; card.classList.add('inserting');
    const [x, y] = center(card); burst(x, y, { n: 26, spread: 160 }); buzz(15);
    setTimeout(() => { location.href = card.href; }, 420);
  });
});

// --- revelar ao rolar ------------------------------------------------------------
$$('.section-title, .open-lab, footer').forEach(el => el.classList.add('mx-reveal'));
const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('mx-on'); io.unobserve(en.target); } }), { threshold: .18 });
$$('.mx-reveal').forEach(el => io.observe(el));
window.addEventListener('pageshow', e => { if (e.persisted) $$('.cartridge.inserting').forEach(c => c.classList.remove('inserting')); });
