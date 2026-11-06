const $ = (selector) => document.querySelector(selector);
const STORE_KEY = 'hardware-simulator-project-v1';
const CUSTOM_KEY = 'hardware-simulator-custom-parts-v1';
const STARTER_CODE = `// Exemplo: pisca o LED ligado ao pino 13\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}`;

const catalog = [
  {type:'uno',name:'Arduino Uno',category:'Placas',tag:'MCU',width:182,height:220,icon:'board',pins:[['D0',0,26],['D1',0,38],['D2',0,50],['D3',0,62],['D4',0,74],['D5',0,86],['D6',0,98],['D7',0,110],['D8',0,122],['D9',0,134],['D10',0,146],['D11',0,158],['D12',0,170],['D13',0,182],['A0',182,38],['A1',182,58],['A2',182,78],['A3',182,98],['A4',182,118],['A5',182,138],['5V',182,164],['GND',182,190]],description:'Placa de desenvolvimento ATmega328P.',voltage:'5 V',kind:'board'},
  {type:'led',name:'LED',category:'Básicos',tag:'LED',width:82,height:70,icon:'led',pins:[['A',0,38],['K',82,38]],description:'Diodo emissor de luz. A = ânodo, K = cátodo.',kind:'load'},
  {type:'resistor',name:'Resistor',category:'Básicos',tag:'R',width:104,height:66,icon:'resistor',pins:[['1',0,34],['2',104,34]],description:'Resistor genérico em série com o circuito.',kind:'conductor'},
  {type:'button',name:'Botão',category:'Básicos',tag:'SW',width:82,height:66,icon:'button',pins:[['1',0,34],['2',82,34]],description:'Chave momentânea. Alterne para abrir ou fechar o contato.',kind:'switch'},
  {type:'source',name:'Fonte DC',category:'Energia',tag:'5V',width:80,height:72,icon:'source',pins:[['+',0,36],['−',80,36]],description:'Fonte de alimentação DC ideal para protótipos.',voltage:'5 V',kind:'source'},
  {type:'vcc',name:'Trilho VCC',category:'Energia',tag:'+5V',width:72,height:66,icon:'custom',pins:[['VCC',72,33]],description:'Trilho de alimentação positivo ideal de 5 V.',voltage:'5 V',kind:'highRail'},
  {type:'gnd',name:'Trilho GND',category:'Energia',tag:'GND',width:72,height:66,icon:'custom',pins:[['GND',72,33]],description:'Referência de terra do circuito.',voltage:'0 V',kind:'lowRail'},
  {type:'buzzer',name:'Buzzer',category:'Saídas',tag:'BZ',width:82,height:68,icon:'buzzer',pins:[['+',0,35],['−',82,35]],description:'Transdutor sonoro que responde a uma saída energizada.',kind:'load'},
  {type:'pot',name:'Potenciômetro',category:'Sensores',tag:'10K',width:104,height:78,icon:'pot',pins:[['VCC',0,17],['GND',0,60],['SIG',104,39]],description:'Divisor resistivo ajustável com saída de sinal.',kind:'sensor'},
  {type:'display',name:'Display 16×2',category:'Displays',tag:'LCD',width:112,height:72,icon:'display',pins:[['VCC',0,18],['GND',0,54],['SDA',112,25],['SCL',112,48]],description:'Display de caracteres com interface I²C.',kind:'display'},
  {type:'gate',name:'Porta AND',category:'Lógica',tag:'AND',width:90,height:72,icon:'gate',pins:[['A',0,20],['B',0,52],['Y',90,36]],description:'Saída lógica AND de duas entradas.',kind:'logic'},
  {type:'switch',name:'Chave liga/desliga',category:'Básicos',tag:'SW',width:94,height:66,icon:'button',pins:[['1',0,34],['2',94,34]],description:'Chave mantida. Alterne o contato no painel de propriedades.',kind:'switch'},
  {type:'capacitor',name:'Capacitor',category:'Básicos',tag:'C',width:82,height:66,icon:'custom',pins:[['+',0,34],['−',82,34]],description:'Componente passivo; o modelo transitório será adicionado em uma próxima etapa.',kind:'passive'},
  {type:'diode',name:'Diodo',category:'Básicos',tag:'D',width:82,height:66,icon:'custom',pins:[['A',0,34],['K',82,34]],description:'Diodo semicondutor polarizado; modelo elétrico completo ainda em desenvolvimento.',kind:'passive'},
  {type:'transistor',name:'Transistor NPN',category:'Básicos',tag:'NPN',width:94,height:82,icon:'custom',pins:[['B',0,41],['C',94,22],['E',94,61]],description:'Transistor de junção bipolar NPN para montagem de protótipos.',kind:'passive'},
  {type:'ldr',name:'Sensor de luz LDR',category:'Sensores',tag:'LDR',width:100,height:68,icon:'custom',pins:[['1',0,34],['2',100,34]],description:'Fotoresistor para projetos de detecção de luminosidade.',kind:'sensor'},
  {type:'ultrasonic',name:'Sensor ultrassônico',category:'Sensores',tag:'HC-SR04',width:118,height:84,icon:'custom',pins:[['VCC',0,18],['TRIG',0,40],['ECHO',118,40],['GND',118,66]],description:'Sensor de distância com sinais de trigger e echo.',kind:'sensor'},
  {type:'servo',name:'Micro servo',category:'Saídas',tag:'SG90',width:96,height:82,icon:'custom',pins:[['GND',0,18],['VCC',0,41],['SIG',96,30]],description:'Atuador de posição com alimentação e sinal PWM.',kind:'actuator'},
  {type:'motor',name:'Motor DC',category:'Saídas',tag:'M',width:82,height:72,icon:'custom',pins:[['+',0,36],['−',82,36]],description:'Motor DC para protótipos e robótica.',kind:'actuator'},
  {type:'relay',name:'Módulo relé',category:'Saídas',tag:'1CH',width:118,height:90,icon:'custom',pins:[['VCC',0,18],['GND',0,68],['IN',0,43],['COM',118,18],['NO',118,45],['NC',118,70]],description:'Relé de um canal com entrada de controle e contatos.',kind:'actuator'},
  {type:'rgb',name:'LED RGB',category:'Saídas',tag:'RGB',width:92,height:78,icon:'custom',pins:[['R',0,18],['G',0,38],['B',0,58],['COM',92,38]],description:'LED vermelho, verde e azul de cátodo comum.',kind:'load'},
  {type:'segment',name:'Display 7 segmentos',category:'Displays',tag:'7-SEG',width:96,height:96,icon:'custom',pins:[['A',0,15],['B',96,15],['C',96,34],['D',0,34],['E',0,54],['F',96,54],['G',0,74],['COM',96,74]],description:'Display numérico de sete segmentos.',kind:'display'},
  {type:'neopixel',name:'NeoPixel RGB',category:'Displays',tag:'LED',width:92,height:76,icon:'custom',pins:[['VCC',0,18],['GND',0,56],['DIN',92,28],['DOUT',92,52]],description:'LED RGB endereçável. Protocolo de dados ainda não é simulado.',kind:'display'},
];
const categories = [
  ['Todos','◈'],['Placas','▦'],['Básicos','◉'],['Sensores','⌁'],['Displays','▤'],['Saídas','◖'],['Energia','ϟ'],['Lógica','⋈'],['Customizados','✳']
];
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
let zoom=1, panX=0, panY=0, activeTool='select', simulationTimer=null, simulationStep=0, simulationSteps=[];
let undoStack=[], redoStack=[], saveTimer=null, toastTimer=null, searchTerm='';
const viewport=$('#viewport'), canvas=$('#canvas'), partLayer=$('#partLayer'), wireLayer=$('#wireLayer');

function readSavedProject(){try{const value=JSON.parse(localStorage.getItem(STORE_KEY));return value&&Array.isArray(value.parts)&&Array.isArray(value.wires)?value:null}catch{return null}}
function readCustomParts(){try{const value=JSON.parse(localStorage.getItem(CUSTOM_KEY));return Array.isArray(value)?value:[]}catch{return []}}
function saveProject(showToast=false){try{localStorage.setItem(STORE_KEY,JSON.stringify(project));$('#saveStatus').textContent='Todas as alterações salvas';$('#projectTitle').textContent=project.title;$('#savedDot')?.classList.remove('unsaved');if(showToast)toast('Projeto salvo neste navegador')}catch{toast('Não foi possível salvar neste navegador')}}
function markChanged(){ $('#saveStatus').textContent='Salvando…'; clearTimeout(saveTimer); saveTimer=setTimeout(()=>saveProject(),450)}
function snapshot(){undoStack.push(JSON.stringify(project));if(undoStack.length>50)undoStack.shift();redoStack=[];updateHistoryButtons()}
function restoreSnapshot(raw){stopSimulation();project=JSON.parse(raw);selectedId=null;selectedWire=null;pendingPin=null;$('#codeEditor').value=project.code||STARTER_CODE;renderAll();markChanged()}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify(project));restoreSnapshot(undoStack.pop());updateHistoryButtons()}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify(project));restoreSnapshot(redoStack.pop());updateHistoryButtons()}
function updateHistoryButtons(){$('#undoButton').disabled=!undoStack.length;$('#redoButton').disabled=!redoStack.length;$('#undoButton').style.opacity=undoStack.length?'1':'.45';$('#redoButton').style.opacity=redoStack.length?'1':'.45'}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
function allCatalog(){return [...catalog,...customParts]}
function defFor(type){return allCatalog().find(item=>item.type===type)}
function safeText(text){return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function partIcon(type,large=false){
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
  $('#componentList').innerHTML=list.map(item=>`<button class="component-card" data-add="${safeText(item.type)}" title="Adicionar ${safeText(item.name)}"><span class="component-art">${partIcon(item.type)}</span><span class="component-name">${safeText(item.name)}</span><span class="component-tag">${safeText(item.tag||'CUSTOM')}</span></button>`).join('')||'<div class="no-results">Nenhuma peça encontrada.<br />Tente outro nome ou crie a sua.</div>';
  $('#componentList').querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>addPart(button.dataset.add)));
}
function pinDef(part,pinName){const def=defFor(part.type);return def?.pins.find(([name])=>name===pinName)}
function partNode(id,pinName){const part=project.parts.find(item=>item.id===id);const pin=part&&pinDef(part,pinName);if(!part||!pin)return null;return {x:part.x+pin[1],y:part.y+pin[2]}}
function renderWires(){
  const paths=project.wires.map(wire=>{const a=partNode(wire.a.part,wire.a.pin),b=partNode(wire.b.part,wire.b.pin);if(!a||!b)return '';const mid=Math.round((a.x+b.x)/2);return `<g class="wire-group"><path class="wire-line ${selectedWire===wire.id?'selected':''}" data-wire="${safeText(wire.id)}" style="--wire-color:${safeText(wire.color||'#708a7a')}" d="M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}"/><circle class="wire-dot" cx="${a.x}" cy="${a.y}" r="3"/><circle class="wire-dot" cx="${b.x}" cy="${b.y}" r="3"/></g>`}).join('');
  wireLayer.innerHTML=paths;wireLayer.querySelectorAll('[data-wire]').forEach(path=>path.addEventListener('click',event=>{event.stopPropagation();selectedWire=path.dataset.wire;selectedId=null;renderAll()}));
  if(pendingPin){const node=partNode(pendingPin.part,pendingPin.pin);if(node){const preview=$('#wirePreview');preview.innerHTML=`<svg viewBox="0 0 1800 1200" preserveAspectRatio="none"><path class="preview-line" d="M ${node.x} ${node.y} L ${pointerCanvas.x} ${pointerCanvas.y}"/></svg>`}}
}
let pointerCanvas={x:0,y:0};
function partMarkup(part){
  const def=defFor(part.type);if(!def)return'';
  const classes=['part',`part-${part.type}`,selectedId===part.id?'selected':'',part.settings?.pressed?'pressed':'',part.settings?.lit?'lit':''].filter(Boolean).join(' ');
  let inner='';
  if(part.type==='uno')inner='<div class="uno-board"><div class="uno-usb"></div><div class="uno-label">ARDUINO</div><div class="uno-chip"></div><div class="uno-pinbank"><i></i><i></i><i></i><i></i><i></i></div><div class="uno-led"></div></div>';
  else if(part.type==='led')inner=`<div class="led-bulb" style="--led-color:${safeText(part.settings?.color||'#63c879')}"></div>`;
  else if(part.type==='resistor')inner='<div class="resistor-body"></div>';
  else if(part.type==='button'||part.type==='switch')inner='<div class="button-cap"></div>';
  else if(part.type==='source')inner='<div class="source-symbol">±</div>';
  else if(part.type==='vcc')inner='<div class="source-symbol">+</div>';
  else if(part.type==='gnd')inner='<div class="source-symbol">⏚</div>';
  else if(part.type==='buzzer')inner='<div class="buzzer-disc"></div>';
  else if(part.type==='pot')inner='<div class="pot-knob"></div>';
  else if(part.type==='display')inner=`<span class="display-face">${safeText((part.settings?.screen||'HELLO WORLD').slice(0,13))}</span>`;
  else if(part.type==='gate')inner='<span class="display-face" style="color:#57916b;font-size:20px">&amp;</span>';
  else inner=`<span class="generic-chip"><b>${safeText((def.tag||part.name.slice(0,3)).slice(0,7))}</b><small>${safeText(part.name)}</small></span>`;
  const pins=def.pins.map(([name,x,y])=>`<span class="pin ${pendingPin?.part===part.id&&pendingPin?.pin===name?'pending':''}" data-pin="${safeText(name)}" title="${safeText(name)}" style="left:${x}px;top:${y}px"></span><span class="pin-label ${x===0?'left':'right'}" style="left:${x===0?'auto':x+7+'px'};right:${x===0?'calc(100% + 5px)':'auto'};top:${y-4}px">${safeText(name)}</span>`).join('');
  return `<div class="${classes}" data-part="${safeText(part.id)}" style="left:${part.x}px;top:${part.y}px;width:${def.width}px;height:${def.height+18}px"><div class="part-card" style="width:${def.width}px;height:${def.height}px">${inner}</div><div class="part-title">${safeText(part.name||def.name)}</div>${pins}</div>`;
}
function renderParts(){
  partLayer.innerHTML=project.parts.map(partMarkup).join('');
  partLayer.querySelectorAll('[data-part]').forEach(el=>{
    const id=el.dataset.part;
    el.addEventListener('pointerdown',event=>{
      if(event.target.closest('.pin'))return;
      if(event.button!==0)return;
      const part=project.parts.find(item=>item.id===id);if(!part)return;
      if(event.detail===2&&['button','switch'].includes(part.type)){part.settings.pressed=!part.settings.pressed;renderAll();if(simulationTimer)updateSimulation();return}
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
function renderInspector(){
  const view=$('#propertiesView');
  if(!selectedId){view.innerHTML=`<div class="inspector-empty"><div class="inspector-empty-icon">⌁</div><b>Selecione uma peça</b><p>As propriedades do componente aparecem aqui quando você selecionar uma peça no circuito.</p><button class="text-button" id="openCodeFromEmpty">Editar código Arduino →</button></div>`;$('#openCodeFromEmpty')?.addEventListener('click',()=>showInspectorTab('code'));return}
  const part=project.parts.find(item=>item.id===selectedId);if(!part){selectedId=null;return}
  const def=defFor(part.type);if(!def)return;
  const pins=def.pins.map(pin=>`<div class="property-row"><span>${safeText(pin[0])}</span><b>${project.wires.filter(w=>[w.a,w.b].some(end=>end.part===part.id&&end.pin===pin[0])).length?'Conectado':'Livre'}</b></div>`).join('');
  let controls='';
  if(def.kind==='switch')controls=`<div class="property-section"><p class="property-label">Estado do contato</p><div class="switch-row"><span>${part.settings?.pressed?(part.type==='switch'?'Fechado':'Pressionado'):'Aberto'}</span><button id="toggleButtonPart" class="toggle ${part.settings?.pressed?'on':''}" aria-label="Alternar botão"></button></div></div>`;
  if(part.type==='resistor')controls+=`<div class="property-section"><p class="property-label">Valor</p><input id="partValue" class="property-input" value="${safeText(part.settings?.value||'220 Ω')}" /></div>`;
  if(part.type==='led')controls+=`<div class="property-section"><p class="property-label">Cor</p><div class="property-row"><span>Cor do LED</span><input id="ledColor" type="color" value="${safeText(part.settings?.color||'#e56d5c')}" style="width:30px;height:24px;border:0;background:transparent;cursor:pointer" /></div><div class="property-row"><span>Estado</span><b>${part.settings?.lit?'Ligado':'Desligado'}</b></div></div>`;
  view.innerHTML=`<div class="property-header"><div class="property-type">${safeText(def.category)} · ${safeText(def.tag||'COMPONENTE')}</div><h2>${safeText(part.name||def.name)}</h2></div><div class="property-section"><p class="property-label">Identificação</p><label class="property-row"><span>Nome</span><input id="partName" class="property-input" style="width:130px" value="${safeText(part.name||def.name)}" /></label>${def.voltage?`<div class="property-row"><span>Tensão nominal</span><b>${safeText(def.voltage)}</b></div>`:''}</div>${controls}<div class="property-section"><p class="property-label">Terminais</p>${pins}</div><div class="property-section"><p class="property-label">Sobre</p><p style="font-size:9px;line-height:1.55;color:#77827a;margin:0">${safeText(def.description||'Componente personalizado do seu projeto.')}</p></div><div class="property-section"><button id="deleteSelectedPart" class="text-button delete-part">Remover componente</button></div>`;
  $('#partName')?.addEventListener('change',event=>{part.name=event.target.value.trim()||def.name;markChanged();renderParts();renderInspector()});
  $('#partValue')?.addEventListener('change',event=>{part.settings.value=event.target.value;markChanged()});
  $('#ledColor')?.addEventListener('input',event=>{part.settings.color=event.target.value;markChanged()});
  $('#toggleButtonPart')?.addEventListener('click',()=>{part.settings.pressed=!part.settings.pressed;markChanged();renderAll();if(simulationTimer)updateSimulation()});
  $('#deleteSelectedPart')?.addEventListener('click',deleteSelected);
}
function showInspectorTab(tab){const code=tab==='code';$('#propertiesTab').classList.toggle('active',!code);$('#codeTab').classList.toggle('active',code);$('#propertiesView').hidden=code;$('#codeView').hidden=!code}
function addPart(type,atCenter=true){const def=defFor(type);if(!def)return;stopSimulation();snapshot();const rect=viewport.getBoundingClientRect();const x=atCenter?Math.max(30,Math.min(1520,(rect.width/2-panX)/zoom-def.width/2)):300;const y=atCenter?Math.max(30,Math.min(1000,(rect.height/2-panY)/zoom-def.height/2)):250;const n=project.parts.length;const part={id:`p${Date.now().toString(36)}${Math.floor(Math.random()*1000)}`,type,name:def.name,x:x+n*7%90,y:y+n*5%70,settings:{}};project.parts.push(part);selectedId=part.id;selectedWire=null;renderAll();markChanged()}
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
function updateSimulation(){
  const nodes=[],edges=[];const node=(part,pin)=>`${part}:${pin}`;
  for(const part of project.parts){for(const[pin]of defFor(part.type)?.pins||[])nodes.push(node(part.id,pin));if(part.type==='resistor'||defFor(part.type)?.kind==='conductor')edges.push([node(part.id,defFor(part.type).pins[0][0]),node(part.id,defFor(part.type).pins[1][0])]);if((['button','switch'].includes(part.type)||defFor(part.type)?.kind==='switch')&&part.settings?.pressed)edges.push([node(part.id,defFor(part.type).pins[0][0]),node(part.id,defFor(part.type).pins[1][0])]);}
  for(const wire of project.wires)edges.push([node(wire.a.part,wire.a.pin),node(wire.b.part,wire.b.pin)]);
  const find=unionFind(nodes,edges);const highs=new Set(),lows=new Set();
  for(const part of project.parts){const definition=defFor(part.type);if(part.type==='source'||definition?.kind==='source'){const pins=definition.pins;highs.add(find(node(part.id,part.type==='source'?'+':pins[0][0])));lows.add(find(node(part.id,part.type==='source'?'−':pins[1][0])))}if(definition?.kind==='highRail')highs.add(find(node(part.id,definition.pins[0][0])));if(definition?.kind==='lowRail')lows.add(find(node(part.id,definition.pins[0][0])));if(part.type==='uno'){highs.add(find(node(part.id,'5V')));lows.add(find(node(part.id,'GND')));for(let pin=0;pin<14;pin++){const label=`D${pin}`;if(!pinDef(part,label))continue;const level=part.settings?.outputs?.[label];if(level===1)highs.add(find(node(part.id,label)));if(level===0)lows.add(find(node(part.id,label)))} }}
  const lights=[];
  for(const part of project.parts){if(part.type==='led'){const anode=find(node(part.id,'A')),cathode=find(node(part.id,'K'));const lit=Array.from(highs).some(h=>h===anode)&&Array.from(lows).some(l=>l===cathode);part.settings.lit=lit;lights.push(lit)}if(part.type==='buzzer'){const pos=find(node(part.id,'+')),neg=find(node(part.id,'−'));part.settings.lit=Array.from(highs).some(h=>h===pos)&&Array.from(lows).some(l=>l===neg)}}
  renderParts();if(selectedId)renderInspector();
}
function parseSketch(code){
  const lines=[...code.matchAll(/digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW|1|0)\s*\)\s*;?\s*(?:delay\s*\(\s*(\d+)\s*\)\s*;?)?/gi)];
  return lines.map(match=>({pin:`D${Number(match[1])}`,state:/^(HIGH|1)$/i.test(match[2])?1:0,duration:Math.max(90,Math.min(5000,Number(match[3]||300)))}));
}
function applySimulationStep(){const boards=project.parts.filter(p=>p.type==='uno');for(const board of boards)board.settings.outputs={...(board.settings.outputs||{}),[simulationSteps[simulationStep]?.pin]:simulationSteps[simulationStep]?.state};updateSimulation();}
function runSimulation(){
  if(simulationTimer){stopSimulation();return}
  const sketch=$('#codeEditor').value;simulationSteps=parseSketch(sketch);if(!simulationSteps.length){toast('Não encontrei digitalWrite() com nível HIGH ou LOW no sketch');showInspectorTab('code');$('#codeStatus').textContent='Sem instruções reconhecidas';return}
  project.code=sketch;simulationStep=0;const step=()=>{if(!simulationTimer)return;applySimulationStep();const duration=simulationSteps[simulationStep]?.duration||300;simulationStep=(simulationStep+1)%simulationSteps.length;simulationTimer=setTimeout(step,duration)};
  simulationTimer=setTimeout(step,0);$('#codeStatus').textContent=`${simulationSteps.length} instruções digitais reconhecidas`;renderAll();markChanged();
}
function stopSimulation(){if(simulationTimer){clearTimeout(simulationTimer);simulationTimer=null}for(const part of project.parts)if(part.type==='uno')part.settings.outputs={};updateSimulation();renderAll()}
function loadExample(id){stopSimulation();snapshot();if(id==='empty'){project={version:1,title:'Circuito sem título',parts:[],wires:[],code:STARTER_CODE}}
  if(id==='blink')project=defaultProject();
  if(id==='button')project={version:1,title:'Botão e LED',parts:[{id:'b1',type:'source',name:'Fonte 5 V',x:290,y:320,settings:{}},{id:'sw1',type:'button',name:'Botão',x:480,y:320,settings:{}},{id:'r1',type:'resistor',name:'R1 · 220 Ω',x:660,y:320,settings:{value:'220 Ω'}},{id:'l1',type:'led',name:'LED verde',x:860,y:320,settings:{color:'#64c77d'}}],wires:[{id:'w1',a:{part:'b1',pin:'+'},b:{part:'sw1',pin:'1'}},{id:'w2',a:{part:'sw1',pin:'2'},b:{part:'r1',pin:'1'}},{id:'w3',a:{part:'r1',pin:'2'},b:{part:'l1',pin:'A'}},{id:'w4',a:{part:'l1',pin:'K'},b:{part:'b1',pin:'−'}}],code:STARTER_CODE};
  if(id==='buzzer')project={version:1,title:'Buzzer com botão',parts:[{id:'b1',type:'source',name:'Fonte 5 V',x:300,y:340,settings:{}},{id:'sw1',type:'button',name:'Botão',x:510,y:340,settings:{}},{id:'bz1',type:'buzzer',name:'Buzzer',x:720,y:340,settings:{}}],wires:[{id:'w1',a:{part:'b1',pin:'+'},b:{part:'sw1',pin:'1'}},{id:'w2',a:{part:'sw1',pin:'2'},b:{part:'bz1',pin:'+'}},{id:'w3',a:{part:'bz1',pin:'−'},b:{part:'b1',pin:'−'}}],code:STARTER_CODE};
  $('#codeEditor').value=project.code;selectedId=null;selectedWire=null;pendingPin=null;panX=20;panY=10;zoom=1;$('#examplesDialog').close();showInspectorTab('properties');renderAll();markChanged();toast(`Exemplo “${project.title}” carregado`)
}
function openExamples(){ $('#examplesList').innerHTML=examples.map(item=>`<button class="example-card" data-example="${item.id}"><span class="example-card-icon">${item.icon}</span><b>${safeText(item.title)}</b><small>${safeText(item.category)}<br />${safeText(item.description)}</small></button>`).join('');$('#examplesList').querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>loadExample(button.dataset.example)));$('#examplesDialog').showModal() }
function fitCircuit(){if(!project.parts.length){zoom=1;panX=25;panY=25;renderAll();return}const rect=viewport.getBoundingClientRect();const boxes=project.parts.map(p=>{const d=defFor(p.type);return{x:p.x,y:p.y,w:d.width,h:d.height}});const minX=Math.min(...boxes.map(b=>b.x)),minY=Math.min(...boxes.map(b=>b.y)),maxX=Math.max(...boxes.map(b=>b.x+b.w)),maxY=Math.max(...boxes.map(b=>b.y+b.h));zoom=Math.max(.45,Math.min(1.25,Math.min((rect.width-140)/(maxX-minX+40),(rect.height-170)/(maxY-minY+40))));panX=(rect.width-(maxX-minX)*zoom)/2-minX*zoom;panY=(rect.height-(maxY-minY)*zoom)/2-minY*zoom;renderAll()}
function exportProject(){project.code=$('#codeEditor').value;const blob=new Blob([JSON.stringify({...project,customComponents:customParts},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${(project.title||'circuito').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`;a.click();URL.revokeObjectURL(url);toast('Arquivo JSON exportado')}
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
function convertWokwiDiagram(diagram){
  const connections=Array.isArray(diagram.connections)?diagram.connections:[];
  const references=new Map();
  const endpoint=(address)=>{if(typeof address!=='string')return null;const split=address.indexOf(':');if(split<1)return null;return{id:address.slice(0,split),pin:address.slice(split+1)}};
  for(const connection of connections){if(!Array.isArray(connection))continue;for(const address of connection.slice(0,2)){const point=endpoint(address);if(!point)continue;if(!references.has(point.id))references.set(point.id,new Set());references.get(point.id).add(point.pin)}}
  const typeMap={'wokwi-arduino-uno':'uno','wokwi-arduino-nano':'uno','wokwi-led':'led','wokwi-resistor':'resistor','wokwi-pushbutton':'button','wokwi-pushbutton-6mm':'button','wokwi-slide-switch':'switch','wokwi-buzzer':'buzzer','wokwi-potentiometer':'pot','wokwi-lcd1602':'display','wokwi-lcd2004':'display','wokwi-hc-sr04':'ultrasonic','wokwi-servo':'servo','wokwi-neopixel':'neopixel','wokwi-rgb-led':'rgb','wokwi-7segment':'segment','wokwi-photoresistor-sensor':'ldr','wokwi-relay-module':'relay','wokwi-vcc':'vcc','wokwi-gnd':'gnd'};
  const pinMap=(sourceType,raw)=>{
    const p=String(raw).trim();
    if(['wokwi-arduino-uno','wokwi-arduino-nano'].includes(sourceType)){
      if(/^\d+$/.test(p))return`D${p}`;
      if(/^D\d+$/.test(p))return p;
      if(/^GND(?:\.\d+)?$/i.test(p))return'GND';
      if(/^5V(?:\.\d+)?$/i.test(p))return'5V';
      if(/^A[0-5]$/i.test(p))return p.toUpperCase();
    }
    if(['wokwi-led','wokwi-rgb-led'].includes(sourceType)&&['C','K'].includes(p.toUpperCase()))return'K';
    if(sourceType==='wokwi-buzzer')return({'1':'+','2':'−','+':'+','-':'−','−':'−'})[p]||p;
    if(['wokwi-pushbutton','wokwi-pushbutton-6mm'].includes(sourceType)){
      if(/^1(?:\.|$)/.test(p))return'1';if(/^2(?:\.|$)/.test(p))return'2';
    }
    if(sourceType==='wokwi-servo')return({'PWM':'SIG','V+':'VCC','GND':'GND'})[p]||p;
    if(sourceType==='wokwi-vcc')return'VCC';if(sourceType==='wokwi-gnd')return'GND';
    return p;
  };
  const sourceParts=Array.isArray(diagram.parts)?diagram.parts:[];
  const xValues=sourceParts.map(part=>Number(part.left??part.x??0)).filter(Number.isFinite),yValues=sourceParts.map(part=>Number(part.top??part.y??0)).filter(Number.isFinite);
  const minX=xValues.length?Math.min(...xValues):0,minY=yValues.length?Math.min(...yValues):0;
  const importedCustom=[],partTypes=new Map(),partPinMaps=new Map(),parts=[];
  for(let index=0;index<sourceParts.length&&index<250;index++){
    const source=sourceParts[index]||{},id=String(source.id||`part-${index}`).slice(0,60),sourceType=String(source.type||'unknown');
    const connected=[...(references.get(id)||[])];let targetType=typeMap[sourceType]||null;
    let mappedPins=targetType?connected.map(pin=>[pin,pinMap(sourceType,pin)]):[];
    if(targetType){const def=defFor(targetType);if(!def||mappedPins.some(([,mapped])=>!pinDef({type:targetType},mapped)))targetType=null}
    let definition=targetType?defFor(targetType):null;
    if(!definition){
      const names=connected.length?connected:['P1','P2'];const rawNames=[...new Set(names)].slice(0,40);
      const customType=`custom-wokwi-${id.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,24)}-${index}`;
      const layout=makePinLayout(rawNames,148,false);const boardLike=/arduino|esp|pico|stm|attiny|board|microcontroller/i.test(sourceType);
      definition={type:customType,name:String(sourceType.replace(/^wokwi-/,'').replace(/[-_]/g,' ')).slice(0,30),category:boardLike?'Placas':'Customizados',tag:boardLike?'BOARD':'WOKWI',width:layout.width,height:layout.height,icon:'custom',description:`Peça importada do Wokwi (${sourceType}); modelo elétrico ainda não cadastrado.`,kind:'custom',pins:layout.pins};
      importedCustom.push(definition);targetType=customType;mappedPins=rawNames.map(pin=>[pin,pin]);
    }
    const attrs=source.attrs&&typeof source.attrs==='object'?source.attrs:{};
    const rawName=attrs.label||attrs.name||id;
    const colorMap={red:'#e56d5c',green:'#64c77d',blue:'#63a8e7',yellow:'#edc65a',white:'#f2f3e8',orange:'#ee9457',purple:'#ae82df'};
    let color=typeof attrs.color==='string'?(colorMap[attrs.color.toLowerCase()]||(/^#[\da-f]{6}$/i.test(attrs.color)?attrs.color:null)):null;
    const value=attrs.resistance!==undefined?`${attrs.resistance} Ω`:undefined;
    const x=Number(source.left??source.x??150)-minX+100,y=Number(source.top??source.y??100)-minY+90;
    parts.push({id,type:targetType,name:String(rawName).slice(0,40),x:Math.max(10,Math.min(1650,Number.isFinite(x)?x:100+index*18)),y:Math.max(10,Math.min(1050,Number.isFinite(y)?y:100+index*18)),settings:{...(color?{color}:{}),...(value?{value}:{})}});
    partTypes.set(id,{type:targetType,sourceType});partPinMaps.set(id,new Map(mappedPins));
  }
  const wires=[];let skipped=0;
  for(let index=0;index<connections.length&&index<1000;index++){
    const connection=connections[index];if(!Array.isArray(connection)||connection.length<2){skipped++;continue}
    const from=endpoint(connection[0]),to=endpoint(connection[1]);if(!from||!to){skipped++;continue}
    const fromInfo=partTypes.get(from.id),toInfo=partTypes.get(to.id);if(!fromInfo||!toInfo){skipped++;continue}
    const mapFor=(point,info)=>partPinMaps.get(point.id)?.get(point.pin)||pinMap(info.sourceType,point.pin);
    const aPin=mapFor(from,fromInfo),bPin=mapFor(to,toInfo),aPart=parts.find(part=>part.id===from.id),bPart=parts.find(part=>part.id===to.id);
    if(!aPart||!bPart||!pinDef(aPart,aPin)||!pinDef(bPart,bPin)){skipped++;continue}
    const colors={red:'#d86c62',green:'#54a873',blue:'#648fc6',yellow:'#c6a14c',purple:'#9874b4',orange:'#ca8550',black:'#68746c','':''};
    const color=colors[String(connection[2]||'').toLowerCase()]||'';
    wires.push({id:`w${index+1}`,a:{part:from.id,pin:aPin},b:{part:to.id,pin:bPin},...(color?{color}:{})});
  }
  return{project:{version:1,title:'Circuito importado do Wokwi',parts,wires,code:STARTER_CODE},customComponents:importedCustom,skipped,originalParts:sourceParts.length};
}
function importProject(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const source=JSON.parse(reader.result);let value=source,extraCustom=[],skipped=0,isWokwi=Array.isArray(source.connections);
      if(isWokwi){const converted=convertWokwiDiagram(source);value=converted.project;extraCustom=converted.customComponents;skipped=converted.skipped}
      if(!Array.isArray(value.parts)||!Array.isArray(value.wires))throw new Error('invalid');
      snapshot();
      const definitions=normalizeCustomDefinitions([...(Array.isArray(value.customComponents)?value.customComponents:[]),...extraCustom]);
      customParts=[...customParts.filter(def=>!definitions.some(next=>next.type===def.type)),...definitions];localStorage.setItem(CUSTOM_KEY,JSON.stringify(customParts));
      const safeParts=value.parts.slice(0,250).map((part,index)=>{
        const def=defFor(part.type);if(!def)return null;
        const raw=part.settings&&typeof part.settings==='object'?part.settings:{};
        const settings={pressed:raw.pressed===true,value:typeof raw.value==='string'?raw.value.slice(0,24):undefined,color:typeof raw.color==='string'&&/^#[\da-f]{6}$/i.test(raw.color)?raw.color:undefined,screen:typeof raw.screen==='string'?raw.screen.slice(0,13):undefined};
        if(raw.outputs&&typeof raw.outputs==='object')settings.outputs=Object.fromEntries(Object.entries(raw.outputs).filter(([pin,level])=>/^D(?:[0-9]|1[0-3])$/.test(pin)&&(level===0||level===1)));
        return{id:String(part.id||`part-${index}`).slice(0,60),type:def.type,name:String(part.name||def.name).slice(0,40),x:Math.max(0,Math.min(1680,Number.isFinite(Number(part.x))?Number(part.x):40)),y:Math.max(0,Math.min(1080,Number.isFinite(Number(part.y))?Number(part.y):40)),settings};
      }).filter(Boolean);
      const ids=new Set(safeParts.map(part=>part.id));
      const safeWires=value.wires.slice(0,1000).filter(wire=>wire&&ids.has(wire.a?.part)&&ids.has(wire.b?.part)&&pinDef(safeParts.find(part=>part.id===wire.a.part),String(wire.a.pin))&&pinDef(safeParts.find(part=>part.id===wire.b.part),String(wire.b.pin))).map((wire,index)=>({id:String(wire.id||`wire-${index}`).slice(0,60),a:{part:String(wire.a.part),pin:String(wire.a.pin)},b:{part:String(wire.b.part),pin:String(wire.b.pin)},...(typeof wire.color==='string'&&/^#[\da-f]{6}$/i.test(wire.color)?{color:wire.color}:{})}));
      project={version:1,title:String(value.title||'Projeto importado').slice(0,80),parts:safeParts,wires:safeWires,code:String(value.code||STARTER_CODE).slice(0,20000)};
      $('#codeEditor').value=project.code;selectedId=null;selectedWire=null;pendingPin=null;renderAll();markChanged();
      if(isWokwi)toast(`Importado: ${safeParts.length} peças, ${safeWires.length} fios${skipped?` · ${skipped} conexão(ões) não reconhecida(s)`:''}. O código vem em arquivo separado no Wokwi.`);
      else toast('Projeto importado com sucesso');
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
