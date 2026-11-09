const $ = (selector) => document.querySelector(selector);
const STORE_KEY = 'hardware-simulator-project-v1';
const CUSTOM_KEY = 'hardware-simulator-custom-parts-v1';
const STARTER_CODE = `// Exemplo: pisca o LED ligado ao pino 13\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}`;

// Peças vêm do catálogo (src/parts/catalog.js), carregado antes deste arquivo.
const catalog = window.HSCatalog.parts;
const categories = [
  ['Todos','◈'],['Placas','▦'],['Básicos','◉'],['Sensores','⌁'],['Displays','▤'],['Saídas','◖'],['Energia','ϟ'],['Lógica','⋈'],['Customizados','✳']
];
// Exemplos pequenos embutidos; os projetos completos vêm de examples/index.json (pasta + circuito + firmware).
const examples = [
  {id:'blink',title:'LED piscando',category:'Arduino · Iniciante',description:'Arduino Uno, resistor e LED com uma sequência digital no pino 13.',icon:'◉'},
  {id:'button',title:'Botão e LED',category:'Chaves · Básico',description:'Acione o LED ao fechar um botão em um circuito de 5 V.',icon:'⊙'},
  {id:'buzzer',title:'Buzzer com botão',category:'Saída · Básico',description:'Controle um buzzer com botão e fonte DC.',icon:'◖'},
  {id:'empty',title:'Circuito em branco',category:'Comece do zero',description:'Uma área vazia para montar seu próprio projeto.',icon:'＋'},
];
const defaultProject = () => ({version:1,title:'LED piscando',parts:[
  {id:'u1',type:'uno',name:'Arduino Uno',x:320,y:235,settings:{}},
  {id:'r1',type:'resistor',name:'R1 · 220 Ω',x:600,y:302,settings:{value:'220 Ω'}},
  {id:'l1',type:'led',name:'LED vermelho',x:786,y:300,settings:{color:'#e56d5c'}},
],wires:[
  {id:'w1',a:{part:'u1',pin:'D13'},b:{part:'r1',pin:'1'}},
  {id:'w2',a:{part:'r1',pin:'2'},b:{part:'l1',pin:'A'}},
  {id:'w3',a:{part:'l1',pin:'K'},b:{part:'u1',pin:'GND'}},
],code:STARTER_CODE});
let project = readSavedProject() || defaultProject();
let customParts = readCustomParts();
let activeCategory='Todos', selectedId=null, selectedWire=null, pendingPin=null;
let zoom=1, panX=0, panY=0, activeTool='select', simulationTimer=null;
let undoStack=[], redoStack=[], saveTimer=null, toastTimer=null, searchTerm='';
const viewport=$('#viewport'), canvas=$('#canvas'), partLayer=$('#partLayer'), wireLayer=$('#wireLayer');

function readSavedProject(){try{const value=JSON.parse(localStorage.getItem(STORE_KEY));return value&&Array.isArray(value.parts)&&Array.isArray(value.wires)?value:null}catch{return null}}
function readCustomParts(){try{const value=JSON.parse(localStorage.getItem(CUSTOM_KEY));return Array.isArray(value)?value:[]}catch{return []}}
// Campos com _ são do tempo de execução (dispositivo emulado, pasta aberta, OLED): nunca vão para o arquivo nem para o desfazer.
const saveJSON=v=>JSON.stringify(v,(k,x)=>k[0]==='_'?undefined:x);
function saveProject(showToast=false){try{localStorage.setItem(STORE_KEY,saveJSON(project));$('#saveStatus').textContent='Todas as alterações salvas';$('#projectTitle').textContent=project.title;$('#savedDot')?.classList.remove('unsaved');if(showToast)toast('Projeto salvo neste navegador')}catch{toast('Não foi possível salvar neste navegador')}}
function markChanged(){ $('#saveStatus').textContent='Salvando…'; clearTimeout(saveTimer); saveTimer=setTimeout(()=>{saveProject();saveCircuitToFolder()},450)}
// Modo projeto local: o circuito também vai para hardware-studio.json na pasta (versionável junto com o código).
function saveCircuitToFolder(){if(!localProject)return;const c=circuitForFile(),text=JSON.stringify(c);if(text===localProject.written)return;localProject.written=text;fetch('api/project/circuit',{method:'POST',headers:{'content-type':'application/json'},body:text}).then(r=>{if(r.ok)$('#saveStatus').textContent=`Salvo em ${localProject.name}/${CIRCUIT_FILE}`}).catch(()=>{})}
function snapshot(){undoStack.push(saveJSON(project));if(undoStack.length>50)undoStack.shift();redoStack=[];updateHistoryButtons()}
function restoreSnapshot(raw){stopSimulation();project=JSON.parse(raw);selectedId=null;selectedWire=null;pendingPin=null;$('#codeEditor').value=project.code||STARTER_CODE;renderAll();markChanged()}
function undo(){if(!undoStack.length)return;redoStack.push(saveJSON(project));restoreSnapshot(undoStack.pop());updateHistoryButtons()}
function redo(){if(!redoStack.length)return;undoStack.push(saveJSON(project));restoreSnapshot(redoStack.pop());updateHistoryButtons()}
function updateHistoryButtons(){$('#undoButton').disabled=!undoStack.length;$('#redoButton').disabled=!redoStack.length;$('#undoButton').style.opacity=undoStack.length?'1':'.45';$('#redoButton').style.opacity=redoStack.length?'1':'.45'}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
function allCatalog(){return [...catalog,...customParts]}
function defFor(type){return allCatalog().find(item=>item.type===type)}
function safeText(text){return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function partIcon(type,large=false){
  const def=defFor(type);if(def&&window.PixelParts)return window.PixelParts.thumb(def);
  const size=large?40:36;
  const shapes={
    board:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><rect x="7" y="3" width="30" height="34" rx="4" fill="#dff0e5" stroke="#57876a"/><rect x="18" y="15" width="10" height="9" rx="1" fill="#343d37"/><path d="M7 10H3m4 6H3m4 6H3m4 6H3m34-18h4m-4 6h4m-4 6h4m-4 6h4" stroke="#829689" stroke-width="2"/></svg>`,
    led:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M14 20a8 8 0 1 1 16 0c0 3-2 4-3 7h-10c-1-3-3-4-3-7Z" fill="#e9f4e8" stroke="#6b9a73" stroke-width="1.5"/><path d="M17 29h10m-9 3h8m-8 2h8M19 26l-1 11m7-11 1 11" stroke="#819187" stroke-width="1.5" stroke-linecap="round"/><path d="m12 10-3-3m26 3 3-3m-18 0V3m10 4 2-4" stroke="#b3c8b4" stroke-width="1.3"/></svg>`,
    resistor:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M3 20h8m22 0h8" stroke="#85968b" stroke-width="2"/><rect x="11" y="13" width="22" height="14" rx="4" fill="#f1e3c8" stroke="#c7a978"/><path d="M17 14v12m5-12v12m5-12v12" stroke="#9c6647" stroke-width="2"/></svg>`,
    button:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M4 20h8m20 0h8" stroke="#87968d" stroke-width="2"/><circle cx="22" cy="20" r="10" fill="#e7eee8" stroke="#9daa9f" stroke-width="1.5"/><circle cx="22" cy="18" r="6" fill="#fff" stroke="#c1ccc3"/><path d="M16 32h12" stroke="#a8b4aa" stroke-width="2"/></svg>`,
    source:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><circle cx="22" cy="20" r="14" fill="#edf5ee" stroke="#81a88c" stroke-width="1.5"/><path d="M22 12v8m-4-4h8M18 27h8" stroke="#548468" stroke-width="2" stroke-linecap="round"/></svg>`,
    buzzer:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><circle cx="22" cy="20" r="13" fill="#3c4940" stroke="#8c9a8f" stroke-width="2"/><circle cx="22" cy="20" r="6" fill="#c3cdc5"/><path d="M6 10c-3 3-3 17 0 20m32-20c3 3 3 17 0 20" fill="none" stroke="#8aa093" stroke-width="1.5"/></svg>`,
    pot:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M4 8h11m14 0h11M4 32h11" stroke="#83948a" stroke-width="1.8"/><circle cx="22" cy="20" r="11" fill="#eaf1eb" stroke="#9bab9f" stroke-width="1.5"/><path d="M22 19 27 12" stroke="#548266" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="20" r="2" fill="#548266"/></svg>`,
    display:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><rect x="4" y="6" width="36" height="28" rx="3" fill="#e6f0e8" stroke="#8ca391"/><rect x="9" y="11" width="26" height="18" rx="2" fill="#24342a"/><path d="M13 17h5m3 0h5m3 0h2M13 23h5m3 0h5m3 0h2" stroke="#8edf9d" stroke-width="1.5"/></svg>`,
    gate:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M4 12h9m-9 16h9m18-8h9" stroke="#829389" stroke-width="1.8"/><path d="M13 8h9a12 12 0 0 1 0 24h-9Z" fill="#e8f2e9" stroke="#77967e" stroke-width="1.5"/><text x="19" y="23" font-size="8" fill="#578066" font-family="monospace">&amp;</text></svg>`,
    custom:`<svg viewBox="0 0 44 40" width="${size}" height="${size}"><path d="M14 7h16l7 7v12l-7 7H14l-7-7V14Z" fill="#ecf5ee" stroke="#87a990" stroke-width="1.5"/><path d="M16 15h12m-12 5h12m-12 5h8" stroke="#55916b" stroke-width="1.6" stroke-linecap="round"/></svg>`
  };
  return shapes[type]||shapes.custom;
}
function renderCategories(){
  const counts=Object.fromEntries(categories.map(([name])=>[name,name==='Todos'?allCatalog().length:allCatalog().filter(item=>item.category===name).length]));
  $('#categoryList').innerHTML=categories.filter(([name])=>name==='Todos'||counts[name]>0||name==='Customizados').map(([name,icon])=>`<button class="category-button ${activeCategory===name?'active':''}" data-category="${safeText(name)}"><span class="category-icon">${icon}</span><span>${safeText(name)}</span><span class="category-count">${counts[name]??0}</span></button>`).join('');
  $('#categoryList').querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{activeCategory=button.dataset.category;renderCategories();renderCatalog()}));
}
function renderCatalog(){
  const list=allCatalog().filter(item=>(activeCategory==='Todos'||item.category===activeCategory)&&(!searchTerm||item.name.toLowerCase().includes(searchTerm)||item.type.toLowerCase().includes(searchTerm)));
  $('#libraryHeading').textContent=activeCategory==='Todos'?'Todos os componentes':activeCategory;
  $('#componentCount').textContent=list.length;
  $('#componentList').innerHTML=list.map(item=>`<button class="component-card" data-add="${safeText(item.type)}" title="Adicionar ${safeText(item.name)}"><span class="component-art">${partIcon(item.type)}</span><span class="component-name">${safeText(item.name)}</span>${modelStatus(item)?.sim?'':'<span class="component-visual" title="Só visual: ainda sem modelo elétrico">só visual</span>'}<span class="component-tag">${safeText(item.tag||'CUSTOM')}</span></button>`).join('')||'<div class="no-results">Nenhuma peça encontrada.<br />Tente outro nome ou crie a sua.</div>';
  $('#componentList').querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>addPart(button.dataset.add)));
}
function pinDef(part,pinName){const def=defFor(part.type);return def?.pins.find(([name])=>name===pinName)}
function partNode(id,pinName){const part=project.parts.find(item=>item.id===id);const pin=part&&pinDef(part,pinName);if(!part||!pin)return null;return {x:part.x+pin[1],y:part.y+pin[2]}}
function renderWires(){
  const paths=project.wires.map(wire=>{const a=partNode(wire.a.part,wire.a.pin),b=partNode(wire.b.part,wire.b.pin);if(!a||!b)return '';const mid=Math.round((a.x+b.x)/2);return `<g class="wire-group"><path class="wire-line ${selectedWire===wire.id?'selected':''}" data-wire="${safeText(wire.id)}" style="--wire-color:${safeText(wire.color||'#708a7a')}" d="M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}"/><circle class="wire-dot" cx="${a.x}" cy="${a.y}" r="3"/><circle class="wire-dot" cx="${b.x}" cy="${b.y}" r="3"/></g>`}).join('');
  wireLayer.innerHTML=paths;wireLayer.querySelectorAll('[data-wire]').forEach(path=>path.addEventListener('click',event=>{event.stopPropagation();selectedWire=path.dataset.wire;selectedId=null;renderAll()}));
  if(pendingPin){const node=partNode(pendingPin.part,pendingPin.pin);if(node){const preview=$('#wirePreview');preview.innerHTML=`<svg viewBox="0 0 1800 1200" preserveAspectRatio="none"><path class="preview-line" d="M ${node.x} ${node.y} L ${pointerCanvas.x} ${pointerCanvas.y}"/></svg>`}}
  if(!pendingPin)$('#wirePreview').innerHTML='';
}
let pointerCanvas={x:0,y:0};
// Só o visual (classes + arte), para atualizar peças sem recriar o elemento durante a simulação.
// Rótulo do pino. No conector duplo do Mega (borda de baixo) vai um rótulo vertical por coluna, como na serigrafia: 22·23 … 52·53.
function pinLabel(def,name,x,y){
  if(def.category==='Placas'&&x>0&&x<def.width){if(y<def.height)return'';const m=/^D(\d+)$/.exec(name);return`<span class="pin-label bottom" style="left:${x-5}px;top:${y+7}px">${m?`${m[1]}·${+m[1]+1}`:safeText(name)}</span>`}
  return`<span class="pin-label ${x===0?'left':'right'}" style="left:${x===0?'auto':x+7+'px'};right:${x===0?'calc(100% + 5px)':'auto'};top:${y-4}px">${safeText(name)}</span>`;
}
function partVisual(part){
  const def=defFor(part.type);if(!def)return null;
  const classes=['part',`part-${part.type}`,selectedId===part.id?'selected':'',part.settings?.pressed?'pressed':'',part.settings?.lit?'lit':'',part.settings?.warn?'warn':''].filter(Boolean).join(' ');
  return{classes,inner:window.PixelParts?window.PixelParts.art(def,part):''};
}
function refreshParts(){
  for(const part of project.parts){
    const el=partLayer.querySelector(`[data-part="${CSS.escape(part.id)}"]`);if(!el){renderParts();return}
    const v=partVisual(part);if(!v)continue;
    if(el.className!==v.classes)el.className=v.classes;
    if(part.settings?.duty!==undefined)el.style.setProperty('--duty',Number(part.settings.duty).toFixed(3));else el.style.removeProperty('--duty');
    const card=el.querySelector('.part-card');if(card&&card._art!==v.inner){card.innerHTML=v.inner;card._art=v.inner}
  }
}
function partMarkup(part){
  const def=defFor(part.type);if(!def)return'';
  const classes=['part',`part-${part.type}`,selectedId===part.id?'selected':'',part.settings?.pressed?'pressed':'',part.settings?.lit?'lit':'',part.settings?.warn?'warn':''].filter(Boolean).join(' ');
  const inner=window.PixelParts?window.PixelParts.art(def,part):'';
  const pins=def.pins.map(([name,x,y])=>`<span class="pin ${pendingPin?.part===part.id&&pendingPin?.pin===name?'pending':''}" data-pin="${safeText(name)}" title="${safeText(name)}" style="left:${x}px;top:${y}px"></span>${pinLabel(def,name,x,y)}`).join('');
  return `<div class="${classes}" data-part="${safeText(part.id)}" style="${part.settings?.duty!==undefined?`--duty:${Number(part.settings.duty).toFixed(3)};`:''}left:${part.x}px;top:${part.y}px;width:${def.width}px;height:${def.height+18}px"><div class="part-card" style="width:${def.width}px;height:${def.height}px">${inner}</div><div class="part-title">${safeText(part.name||def.name)}</div>${pins}</div>`;
}
function renderParts(){
  partLayer.innerHTML=project.parts.map(partMarkup).join('');
  partLayer.querySelectorAll('[data-part]').forEach(el=>{
    const id=el.dataset.part;
    el.addEventListener('pointerdown',event=>{
      if(event.target.closest('.pin'))return;
      if(event.button!==0)return;
      const part=project.parts.find(item=>item.id===id);if(!part)return;
      // Com a simulação rodando, o botão é momentâneo como o real: conduz só enquanto está apertado.
      if(simulationTimer&&part.type==='button'){const set=v=>{part.settings.pressed=v;part._toggledAt=performance.now();el.classList.toggle('pressed',v);updateSimulation({quiet:true})};set(true);window.addEventListener('pointerup',()=>set(false),{once:true});event.preventDefault();return}
      if(event.detail===2&&['button','switch'].includes(part.type)){part.settings.pressed=!part.settings.pressed;part._toggledAt=performance.now();renderAll();if(simulationTimer)updateSimulation();return}
      selectedId=id;selectedWire=null;el.classList.add('selected');renderInspector();
      const startX=event.clientX,startY=event.clientY,originalX=part.x,originalY=part.y;
      const move=e=>{part.x=Math.max(8,Math.min(1680,originalX+(e.clientX-startX)/zoom));part.y=Math.max(8,Math.min(1080,originalY+(e.clientY-startY)/zoom));el.style.left=part.x+'px';el.style.top=part.y+'px';renderWires();renderInspector()};
      const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderWires();renderParts();renderInspector();snapshot();markChanged()};
      window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
      event.preventDefault();
    });
    el.querySelectorAll('[data-pin]').forEach(pin=>pin.addEventListener('click',event=>{event.stopPropagation();connectPin(id,pin.dataset.pin)}));
    el.addEventListener('click',event=>{if(event.detail===1&&event.target.closest('.part-card')){selectedId=id;selectedWire=null;renderInspector();renderParts()}});
  });
}
function renderAll(){
  $('#projectTitle').textContent=project.title||'Circuito sem título';
  canvas.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;
  $('#zoomValue').textContent=`${Math.round(zoom*100)}%`;$('#statusZoom').textContent=`${Math.round(zoom*100)}%`;
  renderCategories();renderCatalog();renderWires();renderParts();renderInspector();
  const active=simulationTimer!==null;
  $('#canvasStats').innerHTML=`${project.parts.length} peças <span>·</span> ${project.wires.length} conexões`;
  $('#emptyState').hidden=project.parts.length>0;
  $('#runButton').classList.toggle('is-running',active);$('#runIcon').textContent=active?'■':'▶';$('#runLabel').textContent=active?'Parar':'Simular';
  $('#runStatus').classList.toggle('running',active);$('#runStatus').innerHTML=active?'<span></span>Simulação em execução':'<span></span>Pronto para simular';
  updateHistoryButtons();
}
function modelStatus(def){
  if(!def)return null;const k=def.kind,t=def.type;
  if(t==='uno')return{sim:true,text:'Simulado: saídas D0–D13 vêm do sketch ou do firmware (.hex).'};
  if(t==='atmega328')return{sim:true,text:'Simulado: executa o firmware do Uno quando tem alimentação (1,8–5,5 V), AVCC ligado e cristal de 16 MHz; avisa o que falta para a placa real funcionar.'};
  if(t==='crystal')return{sim:true,text:'Simulado: libera o boot do ATmega quando está no XTAL1/XTAL2.'};
  if(t==='nano')return{sim:true,text:'Simulado: ATmega328P com firmware (.hex) — D0–D13, A0–A7 (A6/A7 só analógicos), I²C no A4/A5.'};
  if(t==='mega')return{sim:true,text:'Simulado: ATmega2560 com firmware (.hex) — 54 digitais, A0–A15, Serial1–3, I²C no D20/D21, SPI no D50–D53.'};
  if(t==='led'||t==='buzzer')return{sim:true,text:t==='led'?'Simulado: liga quando há tensão no sentido certo. Com firmware, o PWM (analogWrite) controla o brilho.':'Simulado: liga com tensão; com firmware, tone() toca a frequência real no alto-falante.'};
  if(k==='conductor')return{sim:true,text:'Simulado como condutor ideal: liga os dois terminais, sem queda de tensão.'};
  if(k==='switch')return{sim:true,text:'Simulado: abre e fecha o contato.'};
  if(k==='source'||k==='highRail'||k==='lowRail')return{sim:true,text:'Simulado: referência de 5 V ou 0 V.'};
  if(t==='ldr')return{sim:true,text:'Simulado: resistência do GL5528 pela luz (ajuste abaixo); num divisor, o analogRead lê a tensão de verdade.'};
  if(t==='ultrasonic')return{sim:true,text:'Simulado com firmware: TRIG e ECHO em pinos da placa; o eco dura o tempo de ida e volta do som (ajuste distância e temperatura).'};
  if(t==='capacitor')return{sim:true,text:'Simulado: carga e descarga no tempo (RC); avisa polaridade invertida e sobretensão. Vazamento e ruptura ficam na bancada física (studio).'};
  if(t==='diode')return{sim:true,text:'Simulado: conduz de A para K a partir de 0,7 V.'};
  if(t==='transistor')return{sim:true,text:'Simulado: corte, saturação ou região ativa com Ic = hFE·Ib (hFE 100).'};
  if(t==='relay')return{sim:true,text:'Simulado: com 5 V no VCC, IN aciona a bobina e o COM troca do NC para o NO (clique).'};
  if(t==='rgb')return{sim:true,text:'Simulado: três LEDs (R 1,9 V, G e B 3,0 V) com cátodo comum; o PWM mistura a cor.'};
  if(t==='segment')return{sim:true,text:'Simulado: sete LEDs com cátodo comum no COM; cada segmento acende com corrente.'};
  if(t==='motor')return{sim:true,text:'Simulado: ~10 Ω; gira com a tensão (PWM controla a velocidade, polaridade o sentido).'};
  if(t==='gate')return{sim:true,text:'Simulado: Y = A·B (alto ≥ 3 V, baixo ≤ 1,5 V).'};
  if(def.fw?.bus==='pin'&&def.fw.attach==='DATA')return{sim:true,text:`Simulado com firmware: ${def.tag} responde no fio DATA com o protocolo temporizado do datasheet.`};
  if(def.fw?.bus==='i2c'&&def.kind==='sensor')return{sim:true,text:`Simulado com firmware: ${def.tag} no I²C 0x${def.fw.address.toString(16).toUpperCase()}${def.fw.addressSetting?` (0x${Object.values(def.fw.addressSetting).find(v=>typeof v==='number').toString(16).toUpperCase()} com ${def.fw.addressSetting.key.toUpperCase()} no VCC)`:''} (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega). Ajuste as leituras abaixo.`};
  if(t==='neopixel'||t==='neostrip')return{sim:true,text:'Simulado com firmware: as cores são decodificadas do sinal WS2812 no DIN (DOUT segue para o próximo).'};
  if(t==='pot')return{sim:true,text:'Simulado com firmware: a posição vira tensão no pino analógico ligado ao SIG (analogRead).'};
  if(t==='servo')return{sim:true,text:'Simulado com firmware: o ângulo vem da largura do pulso no SIG (biblioteca Servo).'};
  if(t==='lcd1602')return{sim:true,text:'Simulado com firmware: HD44780 em 4 bits; RS, E e D4–D7 em quaisquer pinos da placa (LiquidCrystal).'};
  if(t==='display')return{sim:true,text:'Simulado com firmware: LCD HD44780 com PCF8574 no I²C 0x27 (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega).'};
  if(t==='gc9a01')return{sim:true,text:'Simulado com firmware: 240 × 240 RGB565 pelo SPI da placa (SCK/MOSI: D13/D11 no Uno e Nano, D52/D51 no Mega); CS, DC e RES em quaisquer pinos.'};
  if(t==='oled')return{sim:true,text:'Simulado com firmware: SSD1306 128×64 no I²C 0x3C (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega).'};
  return{sim:false,text:'Só visual: ainda não tem modelo elétrico. Ela entra no desenho e nas conexões, mas não reage à simulação.'};
}
// Um campo de ajuste do catálogo → HTML; o valor salvo em part.settings[key] ou o padrão.
function settingEditor(part,f){const v=part.settings?.[f.key]??f.default,id=`set-${f.key}`,hint=f.hint?`<p class="fw-hint">${safeText(f.hint)}</p>`:'';
  if(f.kind==='range')return`<label class="sensor-row" for="${id}"><span>${safeText(f.label)}</span><b data-sv="${f.key}">${String(v).replace('.',',')} ${safeText(f.unit||'')}</b><input type="range" id="${id}" data-setting="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"></label>${hint}`;
  if(f.kind==='select')return`<div class="property-row"><label for="${id}">${safeText(f.label)}</label><select id="${id}" data-setting="${f.key}">${f.options.map(o=>`<option ${o===v?'selected':''}>${safeText(o)}</option>`).join('')}</select></div>${hint}`;
  if(f.kind==='color')return`<div class="property-row"><label for="${id}">${safeText(f.label)}</label><input type="color" id="${id}" data-setting="${f.key}" value="${safeText(v)}" style="width:30px;height:24px;border:0;background:transparent;cursor:pointer"></div>${hint}`;
  if(f.kind==='check')return`<label class="property-row" for="${id}"><span>${safeText(f.label)}</span><input type="checkbox" id="${id}" data-setting="${f.key}" ${v!==false?'checked':''}></label>${hint}`;
  return`<label class="property-row" for="${id}"><span>${safeText(f.label)}</span><input class="property-input" id="${id}" data-setting="${f.key}" value="${safeText(v)}" style="width:110px"></label>${hint}`}
// Valor vindo de fora (inspector ou arquivo importado) validado pelo esquema do campo.
function settingValue(f,raw){if(f.kind==='range'){const n=Number(String(raw).replace(',','.'));return Number.isFinite(n)?Math.max(f.min,Math.min(f.max,n)):undefined}
  if(f.kind==='select')return f.options.includes(raw)?raw:undefined;if(f.kind==='color')return/^#[\da-f]{6}$/i.test(raw)?raw:undefined;if(f.kind==='check')return typeof raw==='boolean'?raw:undefined;return typeof raw==='string'?raw.slice(0,24):undefined}
function renderInspector(){
  const view=$('#propertiesView');
  if(!selectedId){view.innerHTML=`<div class="inspector-empty"><div class="inspector-empty-icon">⌁</div><b>Selecione uma peça</b><p>As propriedades do componente aparecem aqui quando você selecionar uma peça no circuito.</p><button class="text-button" id="openCodeFromEmpty">Editar código Arduino →</button></div>`;$('#openCodeFromEmpty')?.addEventListener('click',()=>showInspectorTab('code'));return}
  const part=project.parts.find(item=>item.id===selectedId);if(!part){selectedId=null;return}
  const def=defFor(part.type);if(!def)return;
  const pins=def.pins.map(pin=>`<div class="property-row"><span>${safeText(pin[0])}</span><b>${project.wires.filter(w=>[w.a,w.b].some(end=>end.part===part.id&&end.pin===pin[0])).length?'Conectado':'Livre'}</b></div>`).join('');
  let controls='';
  if(def.kind==='switch')controls=`<div class="property-section"><p class="property-label">Estado do contato</p><div class="switch-row"><span>${part.settings?.pressed?(part.type==='switch'?'Fechado':'Pressionado'):'Aberto'}</span><button id="toggleButtonPart" class="toggle ${part.settings?.pressed?'on':''}" aria-label="Alternar botão"></button></div></div>`;
  if(isBoard(part))controls+=`<div class="property-section"><p class="property-label">Firmware (PlatformIO)</p><div class="property-row"><span>${part.settings?.firmware?safeText(part.settings.firmwareName||'firmware.hex'):'Sketch do editor'}</span><b>${part.settings?.firmware?Math.round(part.settings.firmware.length/1024)+' KB':'—'}</b></div><div class="fw-actions"><button id="fwLoad" class="button button-quiet">Carregar .hex</button><button id="fwProject" class="button button-quiet" title="Envia a pasta do projeto PlatformIO (platformio.ini, src/, lib/…) para compilar e rodar">Compilar pasta…</button>${part._projectDir?'<button id="fwRebuild" class="button button-quiet" title="Lê a pasta de novo e recompila">Recompilar</button>':''}${window.showOpenFilePicker?'<button id="fwWatch" class="button button-quiet" title="Recarrega a cada pio run">Vigiar</button>':''}${part.settings?.firmware?'<button id="fwClear" class="text-button">Remover</button>':''}</div><p class="fw-hint">Arquivo: <code>.pio/build/${ioOf(part).env}/firmware.hex</code> (board = ${ioOf(part).env}). Com firmware, a placa roda o código real do ${ioOf(part).chip}; I²C no ${ioOf(part).sda}/${ioOf(part).scl}.</p></div>`;
  if(def.controls)controls+=`<div class="property-section"><p class="property-label">Leituras do sensor</p>${def.controls.map(([k,label,unit,min,max,step,dflt])=>`<label class="sensor-row"><span>${safeText(label)}</span><b data-sv="${k}">${(part.settings?.sensor?.[k]??dflt)} ${safeText(unit)}</b><input type="range" data-sensor="${k}" min="${min}" max="${max}" step="${step}" value="${part.settings?.sensor?.[k]??dflt}"></label>`).join('')}</div>`;
  // Editores e leituras declarados no catálogo (def.settings, def.readouts): o inspector não conhece peças pelo nome.
  if(def.settings?.length)controls+=`<div class="property-section"><p class="property-label">Ajustes</p>${def.settings.map(f=>settingEditor(part,f)).join('')}</div>`;
  if(def.readouts?.length)controls+=`<div class="property-section">${def.readouts.map(r=>{const v=part.settings?.[r.key];return v===undefined&&!('on'in r)?'':`<div class="property-row"><span>${safeText(r.label)}</span><b>${'on'in r?(v?r.on:r.off):typeof v==='number'?v.toFixed(2).replace('.',',')+' '+safeText(r.unit||''):safeText(v)}</b></div>`}).join('')}</div>`;
  // Eventos e endereço I²C vêm do catálogo (def.events, def.fw.addressSetting): nenhuma peça tem código próprio aqui.
  if(def.events?.length)controls+=`<div class="property-section"><p class="property-label">Eventos</p>${def.events.map(([m,label,hint])=>`<button class="button button-quiet" data-event="${m}">${safeText(label)}</button><p class="fw-hint">${safeText(hint||'')}</p>`).join('')}</div>`;
  const addr=def.fw?.addressSetting;if(addr){const[alt,altAddr]=Object.entries(addr).find(([,v])=>typeof v==='number'),hex=n=>'0x'+n.toString(16).toUpperCase(),cur=part.settings?.[addr.key]===alt?alt:'';controls+=`<div class="property-section"><p class="property-label">Endereço I²C</p><div class="property-row"><span>Pino ${addr.key.toUpperCase()}</span><select id="addrSel"><option value="" ${cur?'':'selected'}>GND (${hex(def.fw.address)})</option><option value="${alt}" ${cur?'selected':''}>VCC (${hex(altAddr)})</option></select></div><p class="fw-hint">Dois dispositivos no mesmo endereço não convivem no barramento: troque o pino de endereço de um deles.</p></div>`}
  if(part.settings?.warn)controls+=`<div class="property-section"><p class="model-status visual">⚠ ${safeText(part.settings.warn)}</p></div>`;
  view.innerHTML=`<div class="property-header"><div class="property-type">${safeText(def.category)} · ${safeText(def.tag||'COMPONENTE')}</div><h2>${safeText(part.name||def.name)}</h2></div><div class="property-section"><p class="property-label">Identificação</p><label class="property-row"><span>Nome</span><input id="partName" class="property-input" style="width:130px" value="${safeText(part.name||def.name)}" /></label>${def.voltage?`<div class="property-row"><span>Tensão nominal</span><b>${safeText(def.voltage)}</b></div>`:''}</div>${controls}<div class="property-section"><p class="property-label">Terminais</p>${pins}</div><div class="property-section"><p class="property-label">Sobre</p><p style="font-size:9px;line-height:1.55;color:#77827a;margin:0">${safeText(def.description||'Componente personalizado do seu projeto.')}</p>${(()=>{const st=modelStatus(def);return st?`<p class="model-status ${st.sim?'sim':'visual'}">${st.sim?'●':'◇'} ${safeText(st.text)}</p>`:''})()}</div><div class="property-section"><button id="deleteSelectedPart" class="text-button delete-part">Remover componente</button></div>`;
  $('#partName')?.addEventListener('change',event=>{part.name=event.target.value.trim()||def.name;markChanged();renderParts();renderInspector()});
  $('#toggleButtonPart')?.addEventListener('click',()=>{part.settings.pressed=!part.settings.pressed;part._toggledAt=performance.now();markChanged();if(fw){updateSimulation({quiet:true});renderInspector()}else{renderAll();if(simulationTimer)updateSimulation()}});
  $('#deleteSelectedPart')?.addEventListener('click',deleteSelected);
  $('#fwLoad')?.addEventListener('click',()=>{const input=document.createElement('input');input.type='file';input.accept='.hex';input.onchange=async()=>{const f=input.files[0];if(f)setFirmware(part,await f.text(),f.name)};input.click()});
  $('#fwProject')?.addEventListener('click',()=>pickProject(part));
  $('#fwRebuild')?.addEventListener('click',()=>compileProject(part,part._projectDir));
  $('#fwWatch')?.addEventListener('click',async()=>{try{const[h]=await showOpenFilePicker({types:[{description:'Firmware Intel HEX',accept:{'text/plain':['.hex']}}]});watchFirmware(part,h)}catch{}});
  $('#fwClear')?.addEventListener('click',()=>{stopSimulation();delete part.settings.firmware;delete part.settings.firmwareName;markChanged();renderInspector();toast('Firmware removido: o Uno volta ao sketch do editor')});
  document.querySelectorAll('[data-sensor]').forEach(input=>input.addEventListener('input',e=>{const k=e.target.dataset.sensor,unit=def.controls.find(c=>c[0]===k)[2];part.settings.sensor={...(part.settings.sensor||{}),[k]:Number(e.target.value)};document.querySelector(`[data-sv="${k}"]`).textContent=`${e.target.value} ${unit}`;applySensor(part);markChanged()}));
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener(el.type==='range'||el.type==='color'?'input':'change',()=>{const f=def.settings.find(x=>x.key===el.dataset.setting),v=settingValue(f,el.type==='checkbox'?el.checked:el.value);if(v===undefined)return;part.settings[f.key]=v;const out=document.querySelector(`[data-sv="${f.key}"]`);if(out)out.textContent=`${String(v).replace('.',',')} ${f.unit||''}`;if(f.live)updateSimulation({quiet:true});renderParts();markChanged()}));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>{const d=part._device,m=b.dataset.event;if(!d?.mcu||typeof d[m]!=='function'){toast('Aperte Simular com o firmware carregado e tente de novo');return}d[m]();toast(b.textContent)}));
  $('#addrSel')?.addEventListener('change',e=>{stopSimulation();const k=def.fw.addressSetting.key;if(e.target.value)part.settings[k]=e.target.value;else delete part.settings[k];markChanged();renderInspector()});
}
function showInspectorTab(tab){const code=tab==='code';$('#propertiesTab').classList.toggle('active',!code);$('#codeTab').classList.toggle('active',code);$('#propertiesView').hidden=code;$('#codeView').hidden=!code}
function addPart(type,atCenter=true){const def=defFor(type);if(!def)return;stopSimulation();snapshot();const rect=viewport.getBoundingClientRect();const x=atCenter?Math.max(30,Math.min(1520,(rect.width/2-panX)/zoom-def.width/2)):300;const y=atCenter?Math.max(30,Math.min(1000,(rect.height/2-panY)/zoom-def.height/2)):250;let px=x,py=y;const overlaps=(ax,ay)=>project.parts.some(o=>{const d=defFor(o.type);return d&&ax<o.x+d.width+24&&ax+def.width+24>o.x&&ay<o.y+d.height+40&&ay+def.height+40>o.y});for(let k=0;k<60&&overlaps(px,py);k++){const ang=k*.9,rad=40+k*14;px=x+Math.cos(ang)*rad;py=y+Math.sin(ang)*rad}const part={id:`p${Date.now().toString(36)}${Math.floor(Math.random()*1000)}`,type,name:def.name,x:Math.max(8,px),y:Math.max(8,py),settings:{}};project.parts.push(part);selectedId=part.id;selectedWire=null;renderAll();markChanged()}
function connectPin(part,pin){
  if(!pendingPin){pendingPin={part,pin};selectedId=null;selectedWire=null;renderWires();renderParts();renderInspector();return}
  const start=pendingPin;pendingPin=null;
  if(start.part===part&&start.pin===pin){renderWires();renderParts();return}
  const exists=project.wires.some(w=>{const same=(end1,end2)=>end1.part===end2.part&&end1.pin===end2.pin;return(same(w.a,start)&&same(w.b,{part,pin}))||(same(w.b,start)&&same(w.a,{part,pin}))});
  if(exists){toast('Esses terminais já estão conectados');renderAll();return}
  snapshot();project.wires.push({id:`w${Date.now().toString(36)}`,a:start,b:{part,pin}});selectedId=null;renderAll();markChanged();if(simulationTimer)updateSimulation()
}
function deleteSelected(){
  if(selectedWire){snapshot();project.wires=project.wires.filter(w=>w.id!==selectedWire);selectedWire=null;renderAll();markChanged();return}
  if(!selectedId)return;
  const id=selectedId;snapshot();project.parts=project.parts.filter(p=>p.id!==id);project.wires=project.wires.filter(w=>w.a.part!==id&&w.b.part!==id);selectedId=null;renderAll();markChanged();if(simulationTimer)updateSimulation()
}
function unionFind(nodes,edges){const parent=new Map(nodes.map(n=>[n,n]));const find=x=>{let r=x;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(x)!==x){const next=parent.get(x);parent.set(x,r);x=next}return r};for(const[a,b]of edges){if(!parent.has(a))parent.set(a,a);if(!parent.has(b))parent.set(b,b);parent.set(find(a),find(b))}return find}
const BOARD_IO=Object.fromEntries(catalog.filter(d=>d.board).map(d=>[d.type,d.board])),UNO_OUT_PINS=BOARD_IO.uno.pins;
const isBoard=p=>!!BOARD_IO[p?.type],ioOf=p=>BOARD_IO[p.type];
let lastNet=null;
// Circuito em CC (src/editor/circuit.js): resistores com o valor escrito, pinos de saída com 25 Ω, pull-up interno de 35 kΩ,
// LEDs/diodos com Vf, NPN como chave saturada, relé e porta AND. Estados que dependem da própria solução são iterados.
let circuitStates={},lastSolve=null,lastConflict='',capTicker=null,lastSketchSolve=0;
// ---------- Projeto inteiro: pasta PlatformIO → servidor local (tools/studio-server.mjs) → pio run → firmware na placa ----------
const SKIP_DIRS=/^(\.pio|\.git|\.vscode|node_modules)$/;
async function readDirHandle(dir,prefix='',out=[]){for await(const [name,h]of dir.entries()){if(h.kind==='directory'){if(!SKIP_DIRS.test(name))await readDirHandle(h,prefix+name+'/',out)}else out.push({path:prefix+name,file:await h.getFile()})}return out}
async function pickProject(part){
  if(window.showDirectoryPicker){try{const dir=await showDirectoryPicker({id:'hs-project'});part._projectDir=dir;await compileProject(part,dir)}catch(e){if(e?.name!=='AbortError')toast(e.message)}return}
  const input=document.createElement('input');input.type='file';input.webkitdirectory=true;input.multiple=true;
  input.onchange=()=>{const list=[...input.files].filter(f=>!f.webkitRelativePath.split('/').some(s=>SKIP_DIRS.test(s))).map(f=>({path:f.webkitRelativePath,file:f}));compileProject(part,list)};input.click();
}
async function compileProject(part,source){let io;
  let files;try{files=Array.isArray(source)?source:await readDirHandle(source,source.name+'/')}catch(e){toast(`Não consegui ler a pasta: ${e.message}`);return}
  if(!files.some(f=>/(^|\/)platformio\.ini$/.test(f.path))){toast('A pasta precisa ter um platformio.ini');return}
  const total=files.reduce((n,f)=>n+f.file.size,0);if(total>40*1024*1024){toast('Projeto grande demais (máx. 40 MB sem a pasta .pio)');return}
  const name=files[0].path.split('/')[0];io=ioOf(part);
  const body={name,mcu:io.mcu,files:await Promise.all(files.map(async f=>{const b=new Uint8Array(await f.file.arrayBuffer());let bin='';for(let i=0;i<b.length;i+=32768)bin+=String.fromCharCode(...b.subarray(i,i+32768));return{path:f.path,data:btoa(bin)}}))};
  showSerial(true);serialLog(`\n── compilando ${name} (${files.length} arquivos) com PlatformIO… ──\n`);toast(`Compilando ${name}…`);
  let r;try{const res=await fetch('api/build',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});r=await res.json()}catch{serialLog('Sem compilador: rode  node tools/studio-server.mjs  e abra o editor pelo endereço que ele mostrar.\n');toast('Para compilar, abra o Studio pelo servidor local (node tools/studio-server.mjs)');return}
  if(!r.ok){serialLog((r.log||'').split('\n').slice(-25).join('\n')+`\n✗ ${r.error}\n`);toast(r.error);return}
  serialLog(`■ ${r.env}: ${r.boardName||r.board} (${r.mcu}) · ${r.size} bytes\n`);
  if(!r.runnable){serialLog(`${r.reason}\n`);toast(r.reason);return}
  if(r.circuit&&applyCircuit(r.circuit,`${name}/${CIRCUIT_FILE}`)){part=boardForBuild({...r,project:name});if(!part){toast(`O circuito de ${name} não tem placa ${r.mcu}`);return}io=ioOf(part)}
  if(r.mcu!==io.mcu){const fits=Object.entries(BOARD_IO).filter(([,v])=>v.mcu===r.mcu).map(([k])=>defFor(k).name).join(' ou ');const msg=`${r.env} compila para ${r.mcu}; esta placa é ${io.chip}. Use ${fits||'outra placa'} ou um [env] com board = ${io.env}.`;serialLog(msg+'\n');toast(msg);return}
  setFirmware(part,r.hex,`${name} · ${r.env}`);renderInspector();
}
// ---------- Projeto local vigiado (node tools/studio-server.mjs --project pasta, extensão do VS Code, app desktop) ----------
// Cada salvar na pasta recompila no servidor; o firmware novo entra na placa certa e a simulação reinicia sozinha.
function projectBadge(text,state){let el=$('#projectBadge');if(!el){el=document.createElement('div');el.id='projectBadge';el.style.cssText='position:fixed;left:270px;bottom:34px;z-index:15;max-width:520px;padding:7px 11px;border-radius:7px;font:10px var(--mono);background:#26332b;color:#e8f1eb;box-shadow:0 6px 20px #17291d2c;cursor:pointer';el.title='Clique para recompilar';el.onclick=()=>fetch('api/project/build',{method:'POST'});document.body.appendChild(el)}el.textContent=text;el.style.background=state==='err'?'#7c2d26':state==='busy'?'#5b5521':'#26332b'}
function boardForBuild(r){
  let board=project.parts.find(p=>isBoard(p)&&ioOf(p).mcu===r.mcu&&p.settings?.firmwareName?.startsWith(r.project+' ·'))||project.parts.find(p=>isBoard(p)&&ioOf(p).mcu===r.mcu);
  if(board||project.parts.some(isBoard))return board;
  // Projeto sem placa: põe a placa do platformio.ini (Nano, Uno ou Mega) no circuito.
  const type=r.mcu==='atmega2560'?'mega':/nano/i.test(r.board||'')?'nano':'uno';addPart(type);return project.parts[project.parts.length-1];
}
// Circuito da pasta do projeto (hardware-studio.json): peças, fios e ajustes; o firmware vem sempre da compilação.
const CIRCUIT_FILE='hardware-studio.json',KEEP_SETTINGS=['value','color','position','bounce','trigger','voltage','sensor','rating','ohms'];
function circuitForFile(){return{version:1,title:project.title,parts:project.parts.map(p=>({id:p.id,type:p.type,name:p.name,x:Math.round(p.x),y:Math.round(p.y),settings:Object.fromEntries([...KEEP_SETTINGS,...(defFor(p.type)?.settings||[]).map(f=>f.key),defFor(p.type)?.fw?.addressSetting?.key].filter(k=>k&&p.settings?.[k]!==undefined).map(k=>[k,p.settings[k]]))})),wires:project.wires.map(({id,a,b,color})=>({id,a,b,...(color?{color}:{})}))}}
function applyCircuit(value,from){try{const next=sanitizeProject(value);stopSimulation();snapshot();project={...next,code:project.code};selectedId=null;selectedWire=null;pendingPin=null;renderAll();fitCircuit();saveProject();toast(`Circuito de ${from} carregado`);return true}catch{toast(`${CIRCUIT_FILE} inválido`);return false}}
let localProject=null;
async function connectLocalProject(){
  let info;try{const res=await fetch('api/health');if(!res.ok)return;info=await res.json()}catch{return}
  if(!info.project)return;projectBadge(`📁 ${info.project} · aguardando compilação…`,'busy');
  localProject={name:info.project,written:''};
  try{const p=await(await fetch('api/project')).json();if(p.circuit){applyCircuit(p.circuit,info.project);localProject.written=JSON.stringify(circuitForFile())}}catch{}
  let seen=0;const es=new EventSource('api/project/events');
  es.addEventListener('circuit',e=>{const c=JSON.parse(e.data);if(JSON.stringify(c)===localProject.written)return;const running=!!simulationTimer;const fwBoards=project.parts.filter(p=>p.settings?.firmware).map(p=>[ioOf(p)?.mcu,p.settings.firmware,p.settings.firmwareName]);if(applyCircuit(c,CIRCUIT_FILE)){localProject.written=JSON.stringify(circuitForFile());for(const[mcu,hex,name]of fwBoards){const b=project.parts.find(p=>isBoard(p)&&ioOf(p).mcu===mcu);if(b){b.settings.firmware=hex;b.settings.firmwareName=name}}if(running)runSimulation()}});
  es.addEventListener('building',e=>{const d=JSON.parse(e.data);projectBadge(`📁 ${info.project} · compilando (${d.reason})…`,'busy')});
  es.addEventListener('build',e=>{const r=JSON.parse(e.data);if(r.seq<=seen)return;seen=r.seq;showSerial(true);
    if(!r.ok){projectBadge(`📁 ${info.project} · ✗ ${r.error}`,'err');serialLog(`\n${(r.log||'').split('\n').slice(-20).join('\n')}\n✗ ${r.error}\n`);return}
    if(!r.runnable){projectBadge(`📁 ${info.project} · ${r.env}: compilou, não roda aqui`,'err');serialLog(`\n■ ${r.env}: ${r.boardName} (${r.mcu})\n${r.reason}\n`);return}
    const board=boardForBuild(r);if(!board){const msg=`${r.env} é ${r.mcu}; nenhuma placa com esse chip no circuito.`;projectBadge(`📁 ${info.project} · ${msg}`,'err');serialLog(msg+'\n');return}
    projectBadge(`📁 ${info.project} · ✓ ${r.env} · ${(r.size/1024).toFixed(0)} KB · ${new Date().toLocaleTimeString()}`);
    const running=!!simulationTimer;setFirmware(board,r.hex,`${r.project} · ${r.env}`);if(!running)runSimulation()});
  es.onerror=()=>projectBadge(`📁 ${info.project} · servidor desconectado`,'err');
}
// Sketch rodando sem firmware: o tempo dos capacitores segue o relógio da parede (até 0,1 s por passo).
function sketchDt(){const now=performance.now(),dt=simulationTimer&&simulationTimer!=='firmware'&&lastSketchSolve?Math.min(0.1,(now-lastSketchSolve)/1000):0;lastSketchSolve=now;return dt}
// dt (s): passo de tempo da simulação; com dt > 0 os capacitores carregam e descarregam, sem dt ficam abertos (CC).
// Solver de CC do editor: cada peça entra pelo seu modelo (src/parts/models.js); o laço não conhece tipos de peça.
function solveCircuit(dt=0){
  const C=window.Circuit,HM=window.HSModels;if(!C||!HM)return null;const node=(p,pin)=>`${p}:${pin}`;let state=circuitStates,out;const key=st=>JSON.stringify(st,(k,v)=>typeof v==='number'?+v.toPrecision(2):v);
  const parts=project.parts.map(p=>{const def=defFor(p.type);return{p,def,m:HM.modelFor(def)}}).filter(x=>x.m);
  for(let iter=0;iter<6;iter++){
    const shorts=[],resistors=[],sources=[],diodes=[],tags=[],currents=[],capacitors=[],caps=[];let owner=null;
    const add={resistor:(a,b,r)=>resistors.push([a,b,r]),short:(a,b)=>shorts.push([a,b]),source:x=>sources.push(x),diode:(a,k,vf,rs,extra=null)=>{diodes.push({a,k,vf,rs});tags.push([owner,extra])},current:x=>currents.push(x),capacitor:(x,p)=>{capacitors.push(x);caps.push(p)}};
    for(const w of project.wires)shorts.push([node(w.a.part,w.a.pin),node(w.b.part,w.b.pin)]);
    for(const{p,def,m}of parts)if(m.stamp){owner=p;m.stamp({p,def,s:p.settings||{},n:pin=>node(p.id,pin),C,add,state:state[p.id],dt})}
    out=C.solve({shorts,resistors,sources,diodes,currents,capacitors});out.tags=tags;out.sources=sources;out.caps=caps;
    // Chip nu: a tensão de alimentação que o circuito entrega ao VCC define o nível das saídas no passo seguinte.
    for(const{p,def}of parts)if(def.board?.bare){const vcc=out.volts(node(p.id,'VCC')),gnd=out.volts(node(p.id,'GND'));p._supply=vcc!==undefined&&gnd!==undefined?Math.max(0,vcc-gnd):0}
    const next={};
    for(const{p,def,m}of parts)if(m.settle)next[p.id]=m.settle({p,def,s:p.settings||{},C,state:state[p.id],V:pin=>out.volts(node(p.id,pin)),diodeCurrent:extra=>{const i=tags.findIndex(t=>t[0]===p&&t[1]===extra);return i<0?0:out.diodeCurrent[i]}});
    const same=key(next)===key(state);state=next;if(same)break;
  }
  if(parts.some(({p,m})=>m.clicks&&!!state[p.id]!==!!circuitStates[p.id]))relayClick();
  if(dt>0)out.caps.forEach((p,i)=>{p._vc=out.capVolts[i]});
  circuitStates=state;out.states=state;return out;
}
function relayClick(){try{const ac=window._relayAc||(window._relayAc=new AudioContext()),b=ac.createBuffer(1,ac.sampleRate*0.012,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length/5))*0.3;const src=ac.createBufferSource();src.buffer=b;src.connect(ac.destination);src.start()}catch{}}
function updateSimulation(opts={}){
  const HM=window.HSModels,nodes=[],edges=[];const node=(part,pin)=>`${part}:${pin}`;
  const parts=project.parts.map(p=>{const def=defFor(p.type);return{p,def,m:def&&HM?.modelFor(def)}}).filter(x=>x.def);
  for(const{p,def,m}of parts){for(const[pin]of def.pins)nodes.push(node(p.id,pin));for(const[x,y]of m?.conducts?.(p,def)||[])edges.push([node(p.id,x),node(p.id,y)])}
  for(const wire of project.wires)edges.push([node(wire.a.part,wire.a.pin),node(wire.b.part,wire.b.pin)]);
  const find=unionFind(nodes,edges);const highs=new Set(),lows=new Set();
  for(const{p,def,m}of parts){const r=m?.rails?.(p,def);if(!r)continue;for(const x of r.high)highs.add(find(node(p.id,x)));for(const x of r.low)lows.add(find(node(p.id,x)));
    if(r.outputs)for(const label of def.board.pins){if(!pinDef(p,label))continue;const level=p.settings?.outputs?.[label];if(level===1)highs.add(find(node(p.id,label)));if(level===0)lows.add(find(node(p.id,label)))}}
  lastNet={find,node,highs,lows};
  // PWM e tone vindos do firmware: brilho proporcional e buzzer apitando; modelos com `pwm` repassam o ciclo (NPN: base → coletor).
  const netDuty=new Map(),netTone=new Map();
  for(const{p,def}of parts)if(def.board){for(const[l,d]of Object.entries(p.settings?.duty||{}))netDuty.set(find(node(p.id,l)),d);for(const[l,f]of Object.entries(p.settings?.tone||{}))netTone.set(find(node(p.id,l)),f)}
  for(const{p,m}of parts)if(m?.pwm){const d=netDuty.get(find(node(p.id,m.pwm[0])));if(d!==undefined)netDuty.set(find(node(p.id,m.pwm[1])),d)}
  // Valores elétricos pelo solver de CC; o PWM entra como fração do tempo ligado sobre a corrente com o pino em nível alto.
  const sol=fw?.solve||solveCircuit(sketchDt());lastSolve=sol;if(simulationTimer&&simulationTimer!=='firmware'&&parts.some(x=>x.m?.timeDependent)&&!capTicker)capTicker=setInterval(()=>updateSimulation({quiet:true}),50);
  if(sol){const now=performance.now(),ctx=({p,def})=>({p,def,s:p.settings,C:window.Circuit,now,state:sol.states[p.id],V:pin=>sol.volts(node(p.id,pin)),dutyOf:pins=>{for(const pin of pins){const d=netDuty.get(find(node(p.id,pin)));if(d!==undefined)return d}return 1},toneOf:pin=>netTone.get(find(node(p.id,pin)))});
    for(const{p,m}of parts){delete p.settings.warn;m?.clear?.(p)}
    const byPart=new Map(parts.map(x=>[x.p,x]));
    sol.tags.forEach(([p,extra],i)=>{const x=byPart.get(p);if(x?.m?.diode)x.m.diode(p,extra,sol.diodeCurrent[i]*1e3,ctx(x))});
    for(const x of parts)x.m?.observe?.(ctx(x));
    // Pino de saída fornecendo mais que o limite absoluto do ATmega (40 mA).
    sol.sources.forEach((src,i)=>{if(!src.pin)return;const amps=Math.abs(sol.sourceCurrent[i]||0)*1e3;if(amps>40){const[b,label]=src.pin;b.settings.warn=`${label} está fornecendo ${amps.toFixed(0)} mA: o ${ioOf(b).chip} aguenta 40 mA por pino (máx. absoluto).`}});
    const sig=sol.conflicts.map(c=>c.node).join();if(sig&&sig!==lastConflict)toast('Curto-circuito: duas fontes diferentes ligadas no mesmo ponto');lastConflict=sig;
  }
  if(opts.quiet)refreshParts();else renderParts();if(selectedId&&!opts.quiet)renderInspector();
}
function applyWrites(writes){const boards=project.parts.filter(p=>isBoard(p));for(const board of boards){const outputs={...(board.settings.outputs||{})};for(const w of writes)outputs[`D${w.pin}`]=w.level;board.settings.outputs=outputs}updateSimulation()}
function runSimulation(){
  if(simulationTimer){stopSimulation();return}
  if(project.parts.some(p=>isBoard(p)&&p.settings?.firmware)){startFirmware();return}
  const sketch=$('#codeEditor').value;const parsed=window.Sketch.parse(sketch);
  if(!parsed.writes){toast('O sketch não tem digitalWrite() reconhecido em setup() ou loop()');showInspectorTab('code');$('#codeStatus').textContent=parsed.warnings[0]||'Sem instruções reconhecidas';return}
  project.code=sketch;
  const setupSteps=window.Sketch.timeline(parsed.setup),loopSteps=window.Sketch.timeline(parsed.loop);
  if(parsed.loop.length&&parsed.loopDelay===0)loopSteps[loopSteps.length-1].ms=250;
  let phase='setup',index=0;
  const step=()=>{if(!simulationTimer)return;
    let list=phase==='setup'?setupSteps:loopSteps;
    if(index>=list.length){if(phase==='setup'&&loopSteps.length){phase='loop';index=0;list=loopSteps}else if(phase==='loop'){index=0}else{simulationTimer=setTimeout(()=>{},2147483647);return}}
    const current=list[index++];applyWrites(current.writes);
    simulationTimer=setTimeout(step,Math.max(0,Math.min(10000,current.ms)))};
  simulationTimer=setTimeout(step,0);
  const notes=parsed.warnings.length?` · ${parsed.warnings.length} aviso(s): ${parsed.warnings.slice(0,2).join('; ')}`:'';
  $('#codeStatus').textContent=`${parsed.writes} escrita(s) digital(is) reconhecida(s)${notes}`;$('#codeStatus').title=parsed.warnings.join('\n');
  if(parsed.warnings.length)toast(parsed.warnings[0]);
  renderAll();markChanged();
}
function stopSimulation(){stopFirmware();if(simulationTimer){clearTimeout(simulationTimer);simulationTimer=null}clearInterval(capTicker);capTicker=null;lastSketchSolve=0;circuitStates={};for(const p of project.parts){delete p._vc;delete p._speed;delete p._angle;delete p._t}for(const part of project.parts){delete part.settings.duty;delete part.settings.tone;delete part.settings.lines;delete part.settings.glyphs;delete part.settings.rgb;delete part.settings.segs;delete part.settings.speed;delete part.settings.on;delete part.settings.out;delete part.settings.warn;delete part.settings.modes;delete part.settings.current;delete part.settings.vc;delete part.settings.mode;delete part.settings.angle;delete part.settings.colors}for(const part of project.parts)if(isBoard(part))part.settings.outputs={};updateSimulation();renderAll()}
// ---------- Firmware real (ATmega328P emulado) ----------
let fw=null;
function setFirmware(part,text,name){
  if(!/^:/.test(text.trim())){toast('Isso não parece um .hex do PlatformIO');return}
  const wasRunning=!!fw;stopSimulation();part.settings.firmware=text.trim();part.settings.firmwareName=name||'firmware.hex';markChanged();renderAll();
  toast(`Firmware ${part.settings.firmwareName} carregado no ${part.name}`);if(wasRunning)runSimulation();
}
function watchFirmware(part,handle){
  let stamp=0;clearInterval(part._watch);
  const check=async()=>{try{const f=await handle.getFile();if(f.lastModified!==stamp){const first=!stamp;stamp=f.lastModified;setFirmware(part,await f.text(),f.name);if(!first)toast('Firmware novo: reboot')}}catch{}};
  check();part._watch=setInterval(check,800);
}
// Várias placas ou Serial1–3 do Mega: junta por linha e marca a origem ([Uno 2], [Serial1], [Mega Serial2]).
function serialLog(text,unit,port=0){const el=$('#serialOut');if(!el)return;const many=fw&&fw.units.length>1;
  // Uma placa só: a Serial0 sai crua; linhas da Serial1–3 esperam a Serial0 fechar a linha dela.
  if(unit&&!many&&!port){el.textContent=(el.textContent+text).slice(-12000);if(unit.pend&&/\n$/.test(el.textContent)){el.textContent+=unit.pend;unit.pend=''}el.scrollTop=el.scrollHeight;return}
  if(unit&&(many||port)){const k='buf'+port;unit[k]=(unit[k]||'')+text;const cut=unit[k].lastIndexOf('\n');if(cut<0)return;const tag=[many?unit.board.name:'',port?'Serial'+port:''].filter(Boolean).join(' ');text=unit[k].slice(0,cut+1).split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.length).map(l=>'['+tag+'] '+l+'\n').join('');unit[k]=unit[k].slice(cut+1);if(!many&&el.textContent&&!/\n$/.test(el.textContent)){unit.pend=(unit.pend||'')+text;return}}el.textContent=(el.textContent+text).slice(-12000);el.scrollTop=el.scrollHeight}
// O que uma placa própria com o ATmega328P precisa para dar boot como o Uno (datasheet DS40002061, §29 e §9.2).
function bareChipCheck(p,find,node){
  const net=l=>find(node(p.id,l)),v=p._supply||0,problems=[],notes=[];
  if(v<1.8)problems.push(`sem alimentação: VCC−GND = ${v.toFixed(2).replace('.',',')} V (mínimo 1,8 V)`);
  else if(v>5.5)problems.push(`${v.toFixed(1).replace('.',',')} V no VCC passa do máximo de 5,5 V (absoluto 6 V): o chip queima`);
  else if(v<4.5)notes.push(`${v.toFixed(1).replace('.',',')} V com cristal de 16 MHz está fora da especificação (16 MHz exige 4,5–5,5 V); use 8 MHz ou 5 V`);
  if(net('AVCC')!==net('VCC'))problems.push('AVCC (pino 20) desligado: precisa ir ao VCC mesmo sem usar o ADC');
  const xt=project.parts.filter(q=>q.type==='crystal').some(q=>{const a=find(node(q.id,'1')),b=find(node(q.id,'2'));return(a===net('XTAL1')&&b===net('XTAL2'))||(a===net('XTAL2')&&b===net('XTAL1'))});
  if(!xt)problems.push('sem cristal de 16 MHz no XTAL1/XTAL2: com os fuses do Arduino o chip fica parado esperando o clock');
  const caps=project.parts.filter(q=>q.type==='capacitor'),across=(a,b)=>caps.some(c=>{const x=find(node(c.id,'+')),y=find(node(c.id,'−'));return(x===a&&y===b)||(x===b&&y===a)});
  if(!across(net('VCC'),net('GND')))notes.push('sem capacitor de desacoplamento (100 nF) entre VCC e GND perto do chip');
  if(xt&&!(across(net('XTAL1'),net('GND'))&&across(net('XTAL2'),net('GND'))))notes.push('faltam os 2 × 22 pF do XTAL1/XTAL2 para o GND: o cristal pode não oscilar');
  return{problems,notes};
}
async function startFirmware(){
  let mod,dev;try{[mod,dev,core]=await Promise.all([import('./emulator/avr.mjs'),import('./emulator/devices.mjs'),import('./core/bind.mjs')])}catch{toast('Não foi possível carregar o emulador (sirva a pasta por HTTP)');return}
  updateSimulation({quiet:true});
  const boards=project.parts.filter(p=>isBoard(p)&&p.settings?.firmware);
  const units=[];
  for(const board of boards){
    // Como o avrdude, recusa firmware compilado para outro chip (a assinatura não bate).
    if(ioOf(board).bare){const{problems,notes}=bareChipCheck(board,lastNet.find,lastNet.node);for(const n of notes)serialLog(`[${board.name}] aviso: ${n}\n`);if(problems.length){const msg=`${board.name} não dá boot: ${problems.join('; ')}.`;toast(msg);serialLog(msg+'\n');board.settings.warn=problems[0];renderAll();continue}}
    let mcu;try{const io=ioOf(board),got=mod.detectChip(board.settings.firmware);if(got!==io.mcu)throw Error(`firmware compilado para ${mod.CHIPS[got].name} (${mod.CHIPS[got].board}); esta placa é ${io.chip}. Recompile com board = ${io.env}.`);mcu=mod.createMcu(board.settings.firmware,io.mcu)}catch(e){toast(`${board.name}: ${e.message}`);serialLog(`[${board.name}] ${e.message}\n`);continue}
    const decs=[0,1,2,3].map(()=>new TextDecoder()),unit={board,mcu,devices:null,clock:mod.CLOCK,links:[]};mcu.onSerial=(b,i=0)=>{serialLog(decs[i].decode(new Uint8Array([b]),{stream:true}),unit,i);for(const[from,t,to]of unit.links)if(from===i)t.serialByte(b,to)};
    // Peças → dispositivos emulados pela declaração `fw` do catálogo (src/core/bind.mjs, o mesmo caminho do rig e dos testes).
    const r=core.bindCircuit({mcu,board,io:ioOf(board),parts:project.parts,defFor,net:(id,pin)=>lastNet.find(lastNet.node(id,pin)),devices:dev,now:Date.now()-new Date().getTimezoneOffset()*60e3});
    for(const n of r.notes)serialLog(`[${board.name}] ${n}\n`);
    const devices=r.bound.map(({part,device})=>{part._device=device;applySensor(part);return[part,device]});if(r.driven.size)unit.driven=r.driven;
    try{const saved=localStorage.getItem('hs-eeprom-'+board.id);if(saved)mcu.eeprom.set(saved.match(/../g).map(h=>parseInt(h,16)))}catch{}
    mcu.onEeprom=()=>{clearTimeout(mcu._eeSave);mcu._eeSave=setTimeout(()=>{try{localStorage.setItem('hs-eeprom-'+board.id,Array.from(mcu.eeprom,b=>b.toString(16).padStart(2,'0')).join(''))}catch{}},300)};
    unit.devices=devices;units.push(unit);
  }
  if(!units.length)return;
  // Serial entre placas: TX de uma ligado ao RX de outra (no Mega também Serial1–3: TX1 D18/RX1 D19, TX2 D16/RX2 D17, TX3 D14/RX3 D15).
  const same=(a,b,pa,pb=pa)=>lastNet.find(lastNet.node(a.board.id,pa))===lastNet.find(lastNet.node(b.board.id,pb));
  let lockstep=false;
  for(const a of units)for(const b of units){if(a===b)continue;
    const A=ioOf(a.board),B=ioOf(b.board),sn=i=>i?'Serial'+i:'Serial';
    A.serial.forEach(([tx],ti)=>B.serial.forEach(([,rx],ri)=>{if(same(a,b,tx,rx)){a.links.push([ti,b.mcu,ri]);serialLog(`── ${a.board.name} ${sn(ti)} TX → ${b.board.name} ${sn(ri)} RX ──\n`)}}));
    if(same(a,b,A.sda,B.sda)&&same(a,b,A.scl,B.scl)){a.mcu.linkI2C(b.mcu);lockstep=true;if(a.board.id<b.board.id)serialLog(`── I²C: ${a.board.name} ↔ ${b.board.name} ──\n`)}
    if(same(a,b,A.sck,B.sck)&&same(a,b,A.mosi,B.mosi)){const ss=A.pins.find(l=>same(a,b,l,B.ss));a.mcu.linkSPI(b.mcu,ss);lockstep=true;if(a.board.id<b.board.id)serialLog(`── SPI: ${a.board.name} ↔ ${b.board.name} ──\n`)}}
  const other=project.parts.filter(p=>isBoard(p)&&!p.settings?.firmware).length;
  serialLog(`\n── boot: ${units.map(u=>u.board.settings.firmwareName).join(', ')} ──\n`);
  if(other)toast(`${other} placa(s) sem firmware ficará(ão) parada(s)`);
  fw={units,raf:0,last:0,paint:0,audio:null,lockstep:typeof lockstep!=='undefined'&&lockstep};simulationTimer='firmware';showSerial(true);
  $('#codeStatus').textContent=`Rodando firmware real (${[...new Set(units.map(u=>u.mcu.chip.name))].join(' + ')} a 16 MHz)`;
  renderAll();fw.raf=requestAnimationFrame(firmwareFrame);
}
function firmwareFrame(now){
  if(!fw)return;const dt=fw.last?Math.min((now-fw.last)/1000,.05):0;fw.last=now;fw.solve=solveCircuit(dt);
  // Placas ligadas por I²C/SPI andam juntas em fatias de 10 µs para uma responder no tempo da outra.
  if(fw.lockstep&&dt){for(const u of fw.units)feedInputs(u);const total=Math.round(dt*fw.units[0].clock),slice=160;for(let c=0;c<total;c+=slice)for(const u of fw.units)u.mcu.run(Math.min(slice,total-c))}
  for(const u of fw.units){
    if(!fw.lockstep){feedInputs(u);if(dt)u.mcu.run(Math.round(dt*u.clock))}
    const pins=u.mcu.pinSnapshot(),out={},duty={},tone={},modes={};
    for(const label of ioOf(u.board).pins){const p=pins[label];if(p&&p.mode!=='output')modes[label]=p.mode;if(!p||p.mode!=='output')continue;const pulse=u.mcu.pulseInfo(label);
      if(pulse&&pulse.hz>20&&pulse.hz<20000&&(p.duty===null||p.duty===0||p.duty===1)){tone[label]=pulse.hz;out[label]=1}else{out[label]=p.level;if(p.duty!==null&&p.duty>0&&p.duty<1)duty[label]=p.duty}}
    u.board.settings.outputs=out;u.board.settings.duty=duty;u.board.settings.tone=tone;u.board.settings.modes=modes;
    for(const[p,d]of u.devices){if(p.type==='display'||p.type==='lcd1602'){p.settings.lines=d.lines();p.settings.glyphs=d.glyphs();p.settings.backlight=d.backlight}else p._oled=d}
  }
  if(now-fw.paint>45){fw.paint=now;const pw=$('#powerInfo');if(pw)pw.textContent=fw.units.map(u=>`≈ ${u.mcu.powerUsage().averageMa.toFixed(1).replace('.',',')} mA`).join(' · ');servoAngles();neopixels();updateSimulation({quiet:true});paintOleds();buzzerAudio()}
  fw.raf=requestAnimationFrame(firmwareFrame);
}
// Sliders do inspector → dispositivo emulado (o próprio dispositivo interpreta o controle; ver core/bind.mjs).
let core=null;
function applySensor(p){const d=p._device,def=defFor(p.type);if(d&&def?.controls&&core)core.applyControls(def,p,d)}
// Entradas do firmware pelo solver: nível lógico pelos limiares do ATmega e tensão real nos pinos analógicos.
function feedInputs(u){
  const sol=fw?.solve||lastSolve;if(!sol)return;const pins=u.mcu.pinSnapshot(),n=l=>`${u.board.id}:${l}`,fed=(u.fed||={});
  const bouncing=project.parts.some(p=>(p.type==='button'||p.type==='switch')&&p.settings?.bounce!==false&&p._toggledAt&&performance.now()-p._toggledAt<300);
  for(const label of ioOf(u.board).pins){const p=pins[label];if(!p||p.mode==='output'||u.mcu.pinDevices.has(label)||u.driven?.has(label))continue;
    const lv=window.Circuit.logicLevel(sol.volts(n(label))),prev=fed[label];fed[label]=lv;
    if(bouncing&&lv!==null&&prev!==undefined&&prev!==null&&lv!==prev)bounce(u.mcu,label,lv);else if(lv!==prev||!bouncing)u.mcu.setInput(label,lv)}
  for(let i=0;i<ioOf(u.board).analog;i++){const v=sol.volts(n('A'+i));if(v!==undefined)u.mcu.analog[i]=Math.max(0,Math.min(5,v))}
}
// Contato mecânico trepida: alterna 2 a 5 vezes, com 50–500 µs entre trocas, antes de assentar no nível novo.
function bounce(mcu,label,lv){let t=mcu.cycles,v=lv;const flips=2+Math.floor(Math.random()*4);mcu.setInput(label,lv);for(let i=0;i<flips;i++){t+=Math.round((50+Math.random()*450)*16);v=1-v;const x=v;mcu.schedule(t,()=>mcu.setInput(label,x))}if(v!==lv){t+=Math.round((50+Math.random()*450)*16);mcu.schedule(t,()=>mcu.setInput(label,lv))}}
function servoAngles(){
  if(!fw||!lastNet)return;const{find,node}=lastNet;
  for(const s of project.parts.filter(p=>p.type==='servo')){const sig=find(node(s.id,'SIG'));
    for(const u of fw.units)for(const label of ioOf(u.board).pins)if(find(node(u.board.id,label))===sig){const p=u.mcu.pulseInfo(label);if(p&&p.highUs>400&&p.highUs<2600){const target=Math.max(0,Math.min(180,(p.highUs-544)/(2400-544)*180)),now=performance.now(),dt=s._t?Math.min(0.1,(now-s._t)/1000):0;s._t=now;
      // SG90 a 4,8 V: 0,1 s por 60° → no máximo 600°/s; o braço anda até o alvo em vez de saltar.
      const cur=s._angle??target,step=600*dt;s._angle=Math.abs(target-cur)<=step?target:cur+Math.sign(target-cur)*step;s.settings.angle=Math.round(s._angle)}}}
}
// NeoPixel: segue a corrente DIN→DOUT a partir do pino do Uno e distribui as cores pela ordem dos LEDs.
function neopixels(){
  if(!fw||!lastNet)return;const{find,node}=lastNet;const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
  for(const u of fw.units)for(const label of ioOf(u.board).pins){
    const frame=u.mcu.neopixel(label);if(!frame)continue;let net=find(node(u.board.id,label)),idx=0,guard=0;
    while(guard++<64){const next=project.parts.find(p=>(p.type==='neopixel'||p.type==='neostrip')&&find(node(p.id,'DIN'))===net);if(!next)break;
      const n=next.type==='neostrip'?8:1,cols=[];for(let i=0;i<n;i++)cols.push(hex(frame[idx+i]||[0,0,0]));idx+=n;next.settings.colors=cols;net=find(node(next.id,'DOUT'))}
  }
}
function paintOleds(){
  for(const p of project.parts.filter(p=>p.type==='gc9a01'&&p._device)){const d=p._device;if(d._painted===d.version)continue;const c=document.querySelector(`[data-part="${p.id}"] canvas`);if(!c)continue;d._painted=d.version;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(d.rgba(),240,240),0,0)}
  for(const p of project.parts.filter(p=>p.type==='oled'&&p._oled)){const c=document.querySelector(`[data-part="${p.id}"] canvas`);if(!c)continue;const ctx=c.getContext('2d'),img=ctx.createImageData(128,64),d=p._oled;
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){const on=d.on&&d.pixel(x,y),i=(y*128+x)*4;img.data[i]=on?140:6;img.data[i+1]=on?220:12;img.data[i+2]=on?255:28;img.data[i+3]=255}ctx.putImageData(img,0,0)}
}
function buzzerAudio(){
  if(!fw)return;const hz=project.parts.find(p=>p.type==='buzzer'&&p.settings?.tone)?.settings.tone;
  try{if(hz&&!fw.audio){const ac=new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type='square';g.gain.value=.04;o.connect(g).connect(ac.destination);o.start();fw.audio={ac,o}}
    if(fw.audio){if(hz)fw.audio.o.frequency.setTargetAtTime(hz,fw.audio.ac.currentTime,.01);else{fw.audio.o.stop();fw.audio.ac.close();fw.audio=null}}}catch{}
}
function stopFirmware(){if(!fw)return;cancelAnimationFrame(fw.raf);try{fw.audio?.o.stop();fw.audio?.ac.close()}catch{}for(const u of fw.units)u.board.settings.outputs={};fw=null;simulationTimer=null;$('#codeStatus').textContent='Firmware parado'}
function showSerial(on){const el=$('#serialPanel');if(el)el.hidden=!on}
// Exemplos que moram numa pasta de projeto (examples/firmware/<id>): circuito do hardware-studio.json e firmware pronto.
async function loadFolderExample(ex){
  try{const c=await(await fetch(ex.circuit)).json();applyCircuit(c,ex.title);$('#examplesDialog').close();
    const hex=await fetch(ex.firmware);const board=project.parts.find(isBoard);if(hex.ok&&board){setFirmware(board,await hex.text(),`${ex.id} · firmware`);toast(`${ex.title}: firmware real carregado, aperte Simular`)}}
  catch{toast('Abra pelo servidor local (node tools/studio-server.mjs) para carregar este exemplo')}
}
// Manifesto de projetos: cada entrada é uma pasta PlatformIO com circuito (hardware-studio.json) e firmware compilado.
const manifestReady=fetch('examples/index.json').then(r=>r.ok?r.json():{projects:[]}).then(m=>{examples.unshift(...m.projects.map(p=>({...p,folder:true})));return m}).catch(()=>({projects:[]}));
function loadExample(id){const ex=examples.find(e=>e.id===id);if(ex?.folder){loadFolderExample(ex);return}stopSimulation();snapshot();if(id==='empty'){project={version:1,title:'Circuito sem título',parts:[],wires:[],code:STARTER_CODE}}
  if(id==='blink')project=defaultProject();
  if(id==='button')project={version:1,title:'Botão e LED',parts:[{id:'b1',type:'source',name:'Fonte 5 V',x:290,y:320,settings:{}},{id:'sw1',type:'button',name:'Botão',x:480,y:320,settings:{}},{id:'r1',type:'resistor',name:'R1 · 220 Ω',x:660,y:320,settings:{value:'220 Ω'}},{id:'l1',type:'led',name:'LED verde',x:860,y:320,settings:{color:'#64c77d'}}],wires:[{id:'w1',a:{part:'b1',pin:'+'},b:{part:'sw1',pin:'1'}},{id:'w2',a:{part:'sw1',pin:'2'},b:{part:'r1',pin:'1'}},{id:'w3',a:{part:'r1',pin:'2'},b:{part:'l1',pin:'A'}},{id:'w4',a:{part:'l1',pin:'K'},b:{part:'b1',pin:'−'}}],code:STARTER_CODE};
  if(id==='buzzer')project={version:1,title:'Buzzer com botão',parts:[{id:'b1',type:'source',name:'Fonte 5 V',x:300,y:340,settings:{}},{id:'sw1',type:'button',name:'Botão',x:510,y:340,settings:{}},{id:'bz1',type:'buzzer',name:'Buzzer',x:720,y:340,settings:{}}],wires:[{id:'w1',a:{part:'b1',pin:'+'},b:{part:'sw1',pin:'1'}},{id:'w2',a:{part:'sw1',pin:'2'},b:{part:'bz1',pin:'+'}},{id:'w3',a:{part:'bz1',pin:'−'},b:{part:'b1',pin:'−'}}],code:STARTER_CODE};
  $('#codeEditor').value=project.code;selectedId=null;selectedWire=null;pendingPin=null;panX=20;panY=10;zoom=1;$('#examplesDialog').close();showInspectorTab('properties');renderAll();markChanged();toast(`Exemplo “${project.title}” carregado`);if(project.parts.length>10)fitCircuit()
}
function openExamples(){ $('#examplesList').innerHTML=examples.map(item=>`<button class="example-card" data-example="${item.id}"><span class="example-card-icon">${item.icon}</span><b>${safeText(item.title)}</b><small>${safeText(item.category)}<br />${safeText(item.description)}</small></button>`).join('');$('#examplesList').querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>loadExample(button.dataset.example)));$('#examplesDialog').showModal() }
function fitCircuit(){if(!project.parts.length){zoom=1;panX=25;panY=25;renderAll();return}const rect=viewport.getBoundingClientRect();const boxes=project.parts.map(p=>{const d=defFor(p.type);return{x:p.x,y:p.y,w:d.width,h:d.height}});const minX=Math.min(...boxes.map(b=>b.x)),minY=Math.min(...boxes.map(b=>b.y)),maxX=Math.max(...boxes.map(b=>b.x+b.w)),maxY=Math.max(...boxes.map(b=>b.y+b.h));zoom=Math.max(.45,Math.min(1.25,Math.min((rect.width-140)/(maxX-minX+40),(rect.height-170)/(maxY-minY+40))));panX=(rect.width-(maxX-minX)*zoom)/2-minX*zoom;panY=(rect.height-(maxY-minY)*zoom)/2-minY*zoom;renderAll()}
function exportProject(){project.code=$('#codeEditor').value;const blob=new Blob([JSON.stringify({...project,customComponents:customParts},(k,x)=>k[0]==='_'?undefined:x,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${(project.title||'circuito').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`;a.click();URL.revokeObjectURL(url);toast('Arquivo JSON exportado')}
function makePinLayout(names,width=148,paired=false){
  const rows=Math.ceil(names.length/2),height=Math.max(86,rows*20+20),leftCount=rows;
  return{width,height,pins:names.map((name,index)=>{
    if(paired&&index<2)return[String(name).slice(0,20),index===0?0:width,42];
    const adjusted=paired?index-2:index;
    const sideCount=paired?Math.ceil(Math.max(0,names.length-2)/2):leftCount;
    return[String(name).slice(0,20),adjusted<sideCount?0:width,14+(adjusted<sideCount?adjusted:adjusted-sideCount)*20];
  })};
}
function normalizeCustomDefinitions(definitions){
  return(Array.isArray(definitions)?definitions:[]).filter(d=>d&&typeof d.type==='string'&&d.type.startsWith('custom-')&&typeof d.name==='string'&&Array.isArray(d.pins)&&d.pins.length>0).slice(0,100).map(d=>{
    const names=[...new Set(d.pins.slice(0,40).map((pin,i)=>String(Array.isArray(pin)?pin[0]:pin||`P${i+1}`).slice(0,20)))];
    const kind=['custom','conductor','switch','source'].includes(d.kind)?d.kind:'custom';
    const layout=makePinLayout(names,148,['conductor','switch','source'].includes(kind));
    return{type:d.type.slice(0,48),name:d.name.slice(0,30),category:categories.some(c=>c[0]===d.category)?d.category:'Customizados',tag:String(d.tag||'CUSTOM').slice(0,8),width:layout.width,height:layout.height,icon:'custom',description:String(d.description||'Componente importado com pinos personalizados.').slice(0,120),kind,pins:layout.pins};
  });
}
// Projeto vindo de fora (arquivo importado ou hardware-studio.json da pasta do projeto): só campos conhecidos e limitados.
function sanitizeProject(value){
  if(!value||!Array.isArray(value.parts)||!Array.isArray(value.wires))throw new Error('invalid');
      const definitions=normalizeCustomDefinitions(Array.isArray(value.customComponents)?value.customComponents:[]);
      customParts=[...customParts.filter(def=>!definitions.some(next=>next.type===def.type)),...definitions];localStorage.setItem(CUSTOM_KEY,JSON.stringify(customParts));
      const safeParts=value.parts.slice(0,250).map((part,index)=>{
        const def=defFor(part.type);if(!def)return null;
        const raw=part.settings&&typeof part.settings==='object'?part.settings:{};
        // Firmware até 800 mil caracteres: os 256 KB de flash do Mega em Intel HEX.
        const settings={pressed:raw.pressed===true,value:typeof raw.value==='string'?raw.value.slice(0,24):undefined,color:typeof raw.color==='string'&&/^#[\da-f]{6}$/i.test(raw.color)?raw.color:undefined,screen:typeof raw.screen==='string'?raw.screen.slice(0,13):undefined,firmware:typeof raw.firmware==='string'&&raw.firmware.startsWith(':')&&raw.firmware.length<800000?raw.firmware:undefined,firmwareName:typeof raw.firmwareName==='string'?raw.firmwareName.slice(0,60):undefined,position:Number.isFinite(raw.position)?Math.max(0,Math.min(1,raw.position)):undefined,bounce:typeof raw.bounce==='boolean'?raw.bounce:undefined,trigger:raw.trigger==='LOW'||raw.trigger==='HIGH'?raw.trigger:undefined,voltage:Number.isFinite(raw.voltage)?Math.max(0,Math.min(24,raw.voltage)):undefined,ohms:Number.isFinite(raw.ohms)?Math.max(1,Math.min(1e4,raw.ohms)):undefined,rating:typeof raw.rating==='string'&&/^\d{1,3}(\.\d+)?$/.test(raw.rating)?raw.rating:undefined,sensor:raw.sensor&&typeof raw.sensor==='object'?Object.fromEntries(Object.entries(raw.sensor).filter(([k,v])=>/^\w{1,20}$/.test(k)&&Number.isFinite(v))):undefined};
        for(const f of def.settings||[]){if(raw[f.key]!==undefined){const v=settingValue(f,raw[f.key]);if(v!==undefined)settings[f.key]=v}}
        {const k=def.fw?.addressSetting?.key;if(k&&typeof raw[k]==='string'&&raw[k] in def.fw.addressSetting)settings[k]=raw[k]}
        if(raw.outputs&&typeof raw.outputs==='object')settings.outputs=Object.fromEntries(Object.entries(raw.outputs).filter(([pin,level])=>/^D(?:[0-9]|1[0-3])$/.test(pin)&&(level===0||level===1)));
        return{id:String(part.id||`part-${index}`).slice(0,60),type:def.type,name:String(part.name||def.name).slice(0,40),x:Math.max(0,Math.min(1680,Number.isFinite(Number(part.x))?Number(part.x):40)),y:Math.max(0,Math.min(1080,Number.isFinite(Number(part.y))?Number(part.y):40)),settings};
      }).filter(Boolean);
      const ids=new Set(safeParts.map(part=>part.id));
      const safeWires=value.wires.slice(0,1000).filter(wire=>wire&&ids.has(wire.a?.part)&&ids.has(wire.b?.part)&&pinDef(safeParts.find(part=>part.id===wire.a.part),String(wire.a.pin))&&pinDef(safeParts.find(part=>part.id===wire.b.part),String(wire.b.pin))).map((wire,index)=>({id:String(wire.id||`wire-${index}`).slice(0,60),a:{part:String(wire.a.part),pin:String(wire.a.pin)},b:{part:String(wire.b.part),pin:String(wire.b.pin)},...(typeof wire.color==='string'&&/^#[\da-f]{6}$/i.test(wire.color)?{color:wire.color}:{})}));
      return{version:1,title:String(value.title||'Projeto importado').slice(0,80),parts:safeParts,wires:safeWires,code:String(value.code||STARTER_CODE).slice(0,20000)};
}
function importProject(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const value=JSON.parse(reader.result);
      if(Array.isArray(value.connections)&&!Array.isArray(value.wires)){toast('Esse arquivo é de outra ferramenta. Importe um projeto exportado pelo Hardware Studio (.json).');return}
      const next=sanitizeProject(value);snapshot();project=next;
      $('#codeEditor').value=project.code;selectedId=null;selectedWire=null;pendingPin=null;renderAll();markChanged();
      toast('Projeto importado com sucesso');
    }catch{toast('JSON inválido ou formato de circuito desconhecido')}
  };
  reader.readAsText(file);
}
function createCustomPart(){
  const name=$('#customName').value.trim(),category=$('#customCategory').value,pins=$('#customPins').value.split(',').map(value=>value.trim()).filter(Boolean),behavior=$('#customBehavior').value;
  if(!name||!pins.length){toast('Informe nome e pelo menos um pino');return}
  if(['conductor','switch','source'].includes(behavior)&&pins.length<2){toast('Esse comportamento precisa de pelo menos dois pinos');return}
  const safePins=pins.slice(0,24),kind={visual:'custom',conductor:'conductor',switch:'switch',source:'source'}[behavior],paired=['conductor','switch','source'].includes(kind),layout=makePinLayout(safePins,148,paired);
  const description=behavior==='source'?'Fonte DC 5 V: primeiro pino positivo, segundo negativo.':behavior==='conductor'?'Conduz entre os dois primeiros pinos.':behavior==='switch'?'Chave entre os dois primeiros pinos.':'Componente visual personalizado.';
  const def={type:`custom-${Date.now().toString(36)}`,name,category,tag:'CUSTOM',width:layout.width,height:layout.height,icon:'custom',description,kind,pins:layout.pins};
  customParts.push(def);localStorage.setItem(CUSTOM_KEY,JSON.stringify(customParts));activeCategory=category;renderAll();$('#customPartDialog').close();$('#customName').value='';$('#customPins').value='';addPart(def.type);toast('Peça adicionada à biblioteca local');
}
function updateZoom(next,clientX,clientY){const before=zoom;zoom=Math.max(.45,Math.min(1.6,next));if(clientX!==undefined){const rect=viewport.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;panX=x-(x-panX)*(zoom/before);panY=y-(y-panY)*(zoom/before)}renderAll()}
function handleViewportPointer(event){if(event.target.closest('.part')||event.target.closest('.canvas-bottom'))return;if(activeTool==='wire')return;const startX=event.clientX,startY=event.clientY,originX=panX,originY=panY;const move=e=>{panX=originX+e.clientX-startX;panY=originY+e.clientY-startY;canvas.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true})}

$('#codeEditor').value=project.code||STARTER_CODE;
$('#codeEditor').addEventListener('input',()=>{project.code=$('#codeEditor').value;$('#codeStatus').textContent='Alterações pendentes';markChanged()});
$('#propertiesTab').addEventListener('click',()=>showInspectorTab('properties'));
$('#codeTab').addEventListener('click',()=>showInspectorTab('code'));
$('#runButton').addEventListener('click',runSimulation);
connectLocalProject();
{const ex=new URLSearchParams(location.search).get('example');if(ex)manifestReady.then(()=>{if(examples.some(e=>e.id===ex))loadExample(ex)})}
$('#saveButton').addEventListener('click',()=>saveProject(true));
$('#undoButton').addEventListener('click',undo);$('#redoButton').addEventListener('click',redo);
$('#exportButton').addEventListener('click',exportProject);$('#importButton').addEventListener('click',()=>$('#importFile').click());$('#importFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importProject(file);event.target.value=''});
$('#searchInput').addEventListener('input',event=>{searchTerm=event.target.value.trim().toLowerCase();renderCatalog()});
$('#zoomIn').addEventListener('click',()=>updateZoom(zoom+.1));$('#zoomOut').addEventListener('click',()=>updateZoom(zoom-.1));$('#zoomValue').addEventListener('click',()=>{zoom=1;panX=0;panY=0;renderAll()});$('#fitButton').addEventListener('click',fitCircuit);
$('#wireTool').addEventListener('click',()=>{activeTool='wire';$('#wireTool').classList.add('selected');$('#selectTool').classList.remove('selected');$('#canvasHint').innerHTML='Clique em dois pinos para conectar <button id="cancelWire" class="text-button">Cancelar</button>';$('#cancelWire').addEventListener('click',()=>{pendingPin=null;activeTool='select';$('#wireTool').classList.remove('selected');$('#selectTool').classList.add('selected');renderAll()})});
$('#selectTool').addEventListener('click',()=>{activeTool='select';pendingPin=null;$('#selectTool').classList.add('selected');$('#wireTool').classList.remove('selected');$('#canvasHint').textContent='arraste o fundo para mover · clique nos pinos para conectar';renderAll()});
viewport.addEventListener('pointerdown',handleViewportPointer);
viewport.addEventListener('pointermove',event=>{const rect=viewport.getBoundingClientRect();pointerCanvas={x:(event.clientX-rect.left-panX)/zoom,y:(event.clientY-rect.top-panY)/zoom};if(pendingPin)renderWires()});
viewport.addEventListener('wheel',event=>{event.preventDefault();updateZoom(zoom+(event.deltaY<0?.05:-.05),event.clientX,event.clientY)},{passive:false});
$('#examplesButton').addEventListener('click',openExamples);$('#emptyAddButton').addEventListener('click',()=>{activeCategory='Todos';renderCategories();renderCatalog();$('#searchInput').focus()});
$('#customPartButton').addEventListener('click',()=>$('#customPartDialog').showModal());$('#createCustomPart').addEventListener('click',createCustomPart);$('#helpButton').addEventListener('click',()=>$('#helpDialog').showModal());
$('#resetCode').addEventListener('click',()=>{$('#codeEditor').value=STARTER_CODE;project.code=STARTER_CODE;markChanged();$('#codeStatus').textContent='Exemplo restaurado'});
$('#renameProject').addEventListener('click',()=>{const title=prompt('Nome do projeto',project.title||'Circuito sem título');if(title!==null&&title.trim()){project.title=title.trim();$('#projectTitle').textContent=project.title;markChanged()}});
$('#clearButton').addEventListener('click',()=>{if(!project.parts.length)return;stopSimulation();snapshot();project.parts=[];project.wires=[];selectedId=null;selectedWire=null;renderAll();markChanged();toast('Circuito limpo')});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
window.addEventListener('keydown',event=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);if(event.key==='/'&&!typing){event.preventDefault();$('#searchInput').focus()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveProject(true)}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();runSimulation()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!typing){event.preventDefault();event.shiftKey?redo():undo()}if((event.key==='Delete'||event.key==='Backspace')&&!typing){event.preventDefault();deleteSelected()}if(event.key==='Escape'&&pendingPin){pendingPin=null;renderAll()}});
window.addEventListener('resize',()=>{canvas.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`});

renderAll();setTimeout(fitCircuit,30);saveProject();

$('#serialSend')?.addEventListener('submit',e=>{e.preventDefault();const input=$('#serialSendText');if(fw&&input.value){fw.units[0].mcu.serialInput(input.value+'\n');serialLog('» '+input.value+'\n');input.value=''}});
$('#serialClose')?.addEventListener('click',()=>showSerial(false));
