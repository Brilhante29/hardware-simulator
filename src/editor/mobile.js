// Em telas estreitas, biblioteca e inspetor viram gavetas abertas por uma barra inferior.
(() => {
  const narrow = matchMedia('(max-width: 850px)');
  const dock = document.createElement('nav'); dock.className = 'mobile-dock'; dock.setAttribute('aria-label', 'Painéis do editor');
  dock.innerHTML = '<button type="button" data-drawer="library">＋ Peças</button><button type="button" data-drawer="properties">⚙ Propriedades</button><button type="button" data-drawer="code">{ } Código</button>';
  const shade = document.createElement('div'); shade.className = 'drawer-shade';
  document.body.append(shade, dock);
  const close = () => document.body.classList.remove('drawer-library', 'drawer-inspector');
  const open = which => {
    const cls = which === 'library' ? 'drawer-library' : 'drawer-inspector';
    const already = document.body.classList.contains(cls) && (which === 'library' || document.body.dataset.drawerTab === which);
    close(); if (already) return;
    document.body.classList.add(cls); document.body.dataset.drawerTab = which;
    if (which === 'code') document.getElementById('codeTab')?.click();
    if (which === 'properties') document.getElementById('propertiesTab')?.click();
  };
  dock.addEventListener('click', e => { const b = e.target.closest('[data-drawer]'); if (b) open(b.dataset.drawer); });
  shade.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // Adicionar uma peça fecha a gaveta para ela aparecer no canvas.
  document.getElementById('componentList')?.addEventListener('click', e => { if (narrow.matches && e.target.closest('[data-add]')) close(); });
  narrow.addEventListener('change', () => { if (!narrow.matches) close(); });
})();
