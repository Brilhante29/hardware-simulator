/* Display preferences only: no diagnosis, tracking, network, or health profile. */
(() => {
  const key='hardware-studio-display-v1', root=document.documentElement;
  const system=matchMedia('(prefers-color-scheme: dark)');
  const clean=value=>({theme:['light','dark','system'].includes(value?.theme)?value.theme:'system',accessible:value?.accessible===true});
  let prefs={theme:'system',accessible:false}, armed=false, opener=null;
  try{prefs=clean(JSON.parse(localStorage.getItem(key)));}catch{}
  function apply(persist=false){
    root.dataset.theme=prefs.theme==='system'?(system.matches?'dark':'light'):prefs.theme;
    root.dataset.accessible=String(prefs.accessible);
    root.style.colorScheme=root.dataset.theme;
    if(persist)try{localStorage.setItem(key,JSON.stringify(prefs));}catch{}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.theme==='dark'?'#111425':'#f4f7ff');
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===root.dataset.theme)));
    document.querySelectorAll('[data-vision-trigger]').forEach(b=>{b.setAttribute('aria-pressed',String(prefs.accessible));b.setAttribute('aria-label',prefs.accessible?'Ajustar cores: acessibilidade ativada':'Ajustar cores: toque duas vezes para abrir');});
    document.dispatchEvent(new CustomEvent('hardware-display-change',{detail:{...prefs,resolvedTheme:root.dataset.theme}}));
  }
  apply();
  system.addEventListener('change',()=>{if(prefs.theme==='system')apply();});
  window.addEventListener('storage',e=>{if(e.key!==key)return;try{prefs=clean(JSON.parse(e.newValue));apply();}catch{}});
  const eye='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 10h3V7h4V5h6v2h4v3h3v4h-3v3h-4v2H9v-2H5v-3H2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9h6v6H9z" fill="currentColor"/></svg>';
  function ready(){
    const bar=document.createElement('div');bar.className='display-strip';bar.innerHTML='<span class="display-caption">SUA OFICINA. DO SEU JEITO.</span><div class="display-controls" role="group" aria-label="Aparência"><button type="button" data-theme-choice="light" aria-label="Tema claro" aria-pressed="false"><span aria-hidden="true">☀</span><span class="display-label">Claro</span></button><button type="button" data-theme-choice="dark" aria-label="Tema escuro" aria-pressed="false"><span aria-hidden="true">☾</span><span class="display-label">Escuro</span></button><button type="button" data-vision-trigger aria-haspopup="dialog" aria-controls="visionDialog">'+eye+'<span class="display-label">Cores</span><span class="vision-check" aria-hidden="true">✓</span></button></div>';
    const header=document.querySelector('.site-header,.topbar');
    if(root.dataset.surface==='editor')document.querySelector('.workspace')?.prepend(bar);
    else if(header)header.after(bar);else document.body.prepend(bar);
    const status=document.createElement('div');status.className='display-notice';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;document.body.append(status);let noticeTimer;
    function announce(message){status.textContent=message;status.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>status.hidden=true,4500);}
    const dialog=document.createElement('dialog');dialog.id='visionDialog';dialog.className='vision-dialog';dialog.setAttribute('aria-labelledby','visionTitle');dialog.setAttribute('aria-describedby','visionDescription');
    dialog.innerHTML='<form method="dialog"><div class="vision-top"><span>AJUSTE DE VISUALIZAÇÃO</span><button type="button" data-vision-cancel aria-label="Fechar ajustes">×</button></div><div class="vision-eye">'+eye+'</div><h2 id="visionTitle">Seu jeito de ver.</h2><p id="visionDescription">Mais contraste, símbolos e padrões para distinguir os estados. O ajuste acompanha os temas claro e escuro.</p><label class="vision-option"><input id="visionEnabled" type="checkbox"><span><b>Usar cores acessíveis</b><small>Azul e dourado, com pistas além da cor.</small></span></label><div class="vision-samples" aria-label="Exemplos de estados"><span class="sample-normal">✓ Normal</span><span class="sample-warning">△ Atenção</span><span class="sample-failure">× Falha</span></div><p class="vision-privacy">Sem teste de visão ou identificação pessoal. Sua preferência fica neste navegador.</p><div class="vision-actions"><button type="button" data-vision-cancel>Cancelar</button><button type="submit" class="vision-confirm">Confirmar ajuste ↗</button></div></form>';
    document.body.append(dialog);const checkbox=dialog.querySelector('#visionEnabled');
    function open(trigger){armed=false;opener=trigger;status.hidden=true;checkbox.checked=true;dialog.dataset.preview='true';dialog.showModal();checkbox.focus();}
    function trigger(e){if(prefs.accessible||armed){open(e.currentTarget);return;}armed=true;announce('1 de 2. Toque novamente em Cores para abrir o ajuste.');}
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{armed=false;prefs.theme=b.dataset.themeChoice;apply(true);announce(prefs.theme==='dark'?'Oficina no tema escuro.':'Oficina no tema claro.');}));
    document.querySelectorAll('[data-vision-trigger]').forEach(b=>b.addEventListener('click',trigger));
    dialog.querySelectorAll('[data-vision-cancel]').forEach(b=>b.onclick=()=>dialog.close());
    checkbox.onchange=()=>dialog.dataset.preview=String(checkbox.checked);
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();prefs.accessible=checkbox.checked;apply(true);dialog.close();announce(prefs.accessible?'Cores acessíveis ativadas nos dois temas.':'Cores originais restauradas nos dois temas.');};
    dialog.addEventListener('close',()=>{armed=false;opener?.focus();});
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
    // A playful optical cue, not a calibrated Ishihara plate or a gate to access.
    // The same action is always available in the labeled toolbar and by keyboard.
    const scene=document.querySelector('.scene');
    if(scene){
      const secret=document.createElement('button');secret.type='button';secret.className='optical-key';secret.dataset.visionTrigger='';secret.setAttribute('aria-haspopup','dialog');secret.setAttribute('aria-controls','visionDialog');secret.title='Pista óptica experimental · ajustar cores';
      const mask=['0000000000000','0000011100000','0001100011000','0010011100100','0100101010010','0010011100100','0001100011000','0000011100000','0000000000000'];
      let pixels='';for(let y=0;y<13;y++)for(let x=0;x<13;x++){const n=(x*17+y*31)%4,m=mask[y-2]?.[x]==='1';const colors=m?['#ae984e','#b8a152','#9a8b4a','#c0a45b']:['#af6856','#62935a','#b97551','#749f62'];pixels+='<rect x="'+(x*3)+'" y="'+(y*3)+'" width="2" height="2" fill="'+colors[n]+'"/>';}
      secret.innerHTML='<svg viewBox="0 0 39 39" aria-hidden="true">'+pixels+'</svg><span class="optical-tooltip">Ajustar cores</span>';secret.addEventListener('click',trigger);scene.append(secret);
    }
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
