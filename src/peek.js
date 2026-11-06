// Anima a abertura e o recolhimento de <details class="peek">. Sem JS, o <details> nativo continua funcionando.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduce.matches || document.body.classList.contains('no-motion');
  function enhance(details) {
    if (details.dataset.peekReady) return; details.dataset.peekReady = '1';
    const summary = details.querySelector(':scope>summary');
    let body = details.querySelector(':scope>.peek-body');
    if (!body) { body = document.createElement('div'); body.className = 'peek-body'; [...details.childNodes].filter(n => n !== summary).forEach(n => body.append(n)); details.append(body); }
    let running = null;
    summary.addEventListener('click', event => {
      if (still()) return;
      event.preventDefault();
      running?.cancel();
      const opening = !details.open;
      if (opening) details.open = true;
      const full = body.scrollHeight;
      running = body.animate(opening
        ? [{ height: '0px', opacity: 0, transform: 'translateY(-6px)' }, { height: full + 'px', opacity: 1, transform: 'none' }]
        : [{ height: full + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: opening ? 340 : 220, easing: opening ? 'cubic-bezier(.2,1.25,.4,1)' : 'ease-in' });
      running.onfinish = () => { running = null; if (!opening) details.open = false; };
    });
  }
  const run = () => document.querySelectorAll('details.peek').forEach(enhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
