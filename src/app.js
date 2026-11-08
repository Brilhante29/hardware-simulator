const $ = (selector) => document.querySelector(selector);
const STORE_KEY = 'hardware-simulator-project-v1';
const CUSTOM_KEY = 'hardware-simulator-custom-parts-v1';
const STARTER_CODE = `// Exemplo: pisca o LED ligado ao pino 13\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}`;

const catalog = [
  {type:'uno',name:'Arduino Uno',category:'Placas',tag:'MCU',width:182,height:220,icon:'board',pins:[['D0',0,26],['D1',0,38],['D2',0,50],['D3',0,62],['D4',0,74],['D5',0,86],['D6',0,98],['D7',0,110],['D8',0,122],['D9',0,134],['D10',0,146],['D11',0,158],['D12',0,170],['D13',0,182],['A0',182,38],['A1',182,58],['A2',182,78],['A3',182,98],['A4',182,118],['A5',182,138],['5V',182,164],['GND',182,190]],description:'Placa de desenvolvimento ATmega328P.',voltage:'5 V',kind:'board'},
  {type:'mega',name:'Arduino Mega 2560',category:'Placas',tag:'MCU',width:182,height:340,icon:'board',pins:[['D0',0,26],['D1',0,38],['D2',0,50],['D3',0,62],['D4',0,74],['D5',0,86],['D6',0,98],['D7',0,110],['D8',0,122],['D9',0,134],['D10',0,146],['D11',0,158],['D12',0,170],['D13',0,182],['D14',0,194],['D15',0,206],['D16',0,218],['D17',0,230],['D18',0,242],['D19',0,254],['D20',0,266],['D21',0,278],['A0',182,30],['A1',182,42],['A2',182,54],['A3',182,66],['A4',182,78],['A5',182,90],['A6',182,102],['A7',182,114],['A8',182,126],['A9',182,138],['A10',182,150],['A11',182,162],['A12',182,174],['A13',182,186],['A14',182,198],['A15',182,210],['5V',182,236],['GND',182,256],['D22',16,340],['D23',16,328],['D24',26,340],['D25',26,328],['D26',36,340],['D27',36,328],['D28',46,340],['D29',46,328],['D30',56,340],['D31',56,328],['D32',66,340],['D33',66,328],['D34',76,340],['D35',76,328],['D36',86,340],['D37',86,328],['D38',96,340],['D39',96,328],['D40',106,340],['D41',106,328],['D42',116,340],['D43',116,328],['D44',126,340],['D45',126,328],['D46',136,340],['D47',136,328],['D48',146,340],['D49',146,328],['D50',156,340],['D51',156,328],['D52',166,340],['D53',166,328]],description:'Placa ATmega2560: 54 pinos digitais (15 PWM), 16 analógicos, 4 seriais, 256 KB de flash.',voltage:'5 V',kind:'board'},
  {type:'led',name:'LED',category:'Básicos',tag:'LED',width:82,height:70,icon:'led',pins:[['A',0,38],['K',82,38]],description:'Diodo emissor de luz. A = ânodo, K = cátodo.',kind:'load'},
  {type:'resistor',name:'Resistor',category:'Básicos',tag:'R',width:104,height:66,icon:'resistor',pins:[['1',0,34],['2',104,34]],description:'Resistor genérico em série com o circuito.',kind:'conductor'},
  {type:'button',name:'Botão',category:'Básicos',tag:'SW',width:82,height:66,icon:'button',pins:[['1',0,34],['2',82,34]],description:'Chave momentânea. Alterne para abrir ou fechar o contato.',kind:'switch'},
  {type:'source',name:'Fonte DC',category:'Energia',tag:'5V',width:80,height:72,icon:'source',pins:[['+',0,36],['−',80,36]],description:'Fonte de alimentação DC ideal para protótipos.',voltage:'5 V',kind:'source'},
  {type:'vcc',name:'Trilho VCC',category:'Energia',tag:'+5V',width:72,height:66,icon:'custom',pins:[['VCC',72,33]],description:'Trilho de alimentação positivo ideal de 5 V.',voltage:'5 V',kind:'highRail'},
  {type:'gnd',name:'Trilho GND',category:'Energia',tag:'GND',width:72,height:66,icon:'custom',pins:[['GND',72,33]],description:'Referência de terra do circuito.',voltage:'0 V',kind:'lowRail'},
  {type:'buzzer',name:'Buzzer',category:'Saídas',tag:'BZ',width:82,height:68,icon:'buzzer',pins:[['+',0,35],['−',82,35]],description:'Transdutor sonoro que responde a uma saída energizada.',kind:'load'},
  {type:'pot',name:'Potenciômetro',category:'Sensores',tag:'10K',width:104,height:78,icon:'pot',pins:[['VCC',0,17],['GND',0,60],['SIG',104,39]],description:'Divisor resistivo ajustável com saída de sinal.',kind:'sensor'},
  {type:'display',name:'Display 16×2',category:'Displays',tag:'LCD',width:112,height:72,icon:'display',pins:[['VCC',0,18],['GND',0,54],['SDA',112,25],['SCL',112,48]],description:'LCD HD44780 com PCF8574 I²C (0x27). Funciona com firmware real (LiquidCrystal_I2C).',kind:'display',i2c:{cls:'LcdI2C',addr:0x27}},
  {type:'lcd1602',name:'Display 16×2 paralelo',category:'Displays',tag:'LCD',width:112,height:88,icon:'display',pins:[['VCC',0,14],['GND',0,34],['RS',0,54],['E',0,74],['D4',112,14],['D5',112,34],['D6',112,54],['D7',112,74]],description:'LCD HD44780 ligado direto nos pinos (biblioteca LiquidCrystal, modo 4 bits). Funciona com firmware real.',voltage:'5 V',kind:'display',parallelLcd:true},
  {type:'gate',name:'Porta AND',category:'Lógica',tag:'AND',width:90,height:72,icon:'gate',pins:[['A',0,20],['B',0,52],['Y',90,36]],description:'Porta AND (74HC08): Y = A·B com níveis de 5 V.',kind:'logic'},
  {type:'switch',name:'Chave liga/desliga',category:'Básicos',tag:'SW',width:94,height:66,icon:'button',pins:[['1',0,34],['2',94,34]],description:'Chave mantida. Alterne o contato no painel de propriedades.',kind:'switch'},
  {type:'capacitor',name:'Capacitor',category:'Básicos',tag:'C',width:82,height:66,icon:'custom',pins:[['+',0,34],['−',82,34]],description:'Capacitor: em corrente contínua não conduz (circuito aberto). Carga e descarga ficam na bancada física.',kind:'passive'},
  {type:'diode',name:'Diodo',category:'Básicos',tag:'D',width:82,height:66,icon:'custom',pins:[['A',0,34],['K',82,34]],description:'Diodo de silício (1N4148/1N4007): conduz de A para K a partir de ~0,7 V.',kind:'passive'},
  {type:'transistor',name:'Transistor NPN',category:'Básicos',tag:'NPN',width:94,height:82,icon:'custom',pins:[['B',0,41],['C',94,22],['E',94,61]],description:'NPN como chave (2N2222/BC547): com corrente na base (Vbe ≈ 0,7 V), C–E conduz saturado.',kind:'passive'},
  {type:'ldr',name:'Sensor de luz LDR',category:'Sensores',tag:'LDR',width:100,height:68,icon:'custom',pins:[['1',0,34],['2',100,34]],description:'Fotoresistor GL5528: 8–20 kΩ a 10 lux, ~1 MΩ no escuro. Use num divisor com 10 kΩ e leia com analogRead.',kind:'sensor',controls:[['lux','Luz','lx',0,10000,1,300]]},
  {type:'ultrasonic',name:'Sensor ultrassônico',category:'Sensores',tag:'HC-SR04',width:118,height:84,icon:'custom',pins:[['VCC',0,18],['TRIG',0,40],['ECHO',118,40],['GND',118,66]],description:'Sensor de distância HC-SR04 (2–400 cm): pulso no TRIG, eco no ECHO com o tempo de ida e volta do som.',kind:'sensor',controls:[['distanceCm','Distância','cm',2,450,1,100],['temperatureC','Temperatura do ar','°C',-10,50,1,20]]},
  {type:'servo',name:'Micro servo',category:'Saídas',tag:'SG90',width:96,height:82,icon:'custom',pins:[['GND',0,18],['VCC',0,41],['SIG',96,30]],description:'Atuador de posição com alimentação e sinal PWM.',kind:'actuator'},
  {type:'motor',name:'Motor DC',category:'Saídas',tag:'M',width:82,height:72,icon:'custom',pins:[['+',0,36],['−',82,36]],description:'Motor DC pequeno (~10 Ω): gira com a tensão nos terminais; um pino sozinho não aguenta a corrente, use transistor.',kind:'actuator'},
  {type:'relay',name:'Módulo relé',category:'Saídas',tag:'1CH',width:118,height:90,icon:'custom',pins:[['VCC',0,18],['GND',0,68],['IN',0,43],['COM',118,18],['NO',118,45],['NC',118,70]],description:'Módulo relé 5 V: com VCC/GND ligados, IN aciona a bobina e o COM passa do NC para o NO.',kind:'actuator'},
  {type:'rgb',name:'LED RGB',category:'Saídas',tag:'RGB',width:92,height:78,icon:'custom',pins:[['R',0,18],['G',0,38],['B',0,58],['COM',92,38]],description:'LED vermelho, verde e azul de cátodo comum.',kind:'load'},
  {type:'segment',name:'Display 7 segmentos',category:'Displays',tag:'7-SEG',width:96,height:96,icon:'custom',pins:[['A',0,15],['B',96,15],['C',96,34],['D',0,34],['E',0,54],['F',96,54],['G',0,74],['COM',96,74]],description:'Display numérico de sete segmentos.',kind:'display'},
  {type:'bme280',name:'Sensor BME280',category:'Sensores',tag:'BME280',width:104,height:72,icon:'custom',pins:[['VCC',0,18],['GND',0,52],['SCL',104,24],['SDA',104,48]],description:'Temperatura, pressão e umidade (Bosch) no I²C 0x76.',kind:'sensor',module:true,i2c:{cls:'Bme280',addr:0x76},controls:[['temperature','Temperatura','°C',-20,60,0.1,24],['pressure','Pressão','hPa',900,1100,0.5,1013.25],['humidity','Umidade','%',0,100,1,55]]},
  {type:'mpu6050',name:'Acelerômetro MPU6050',category:'Sensores',tag:'MPU6050',width:104,height:72,icon:'custom',pins:[['VCC',0,18],['GND',0,52],['SCL',104,24],['SDA',104,48]],description:'Acelerômetro e giroscópio de 3 eixos no I²C 0x68.',kind:'sensor',module:true,i2c:{cls:'Mpu6050',addr:0x68},controls:[['tiltX','Inclinação X','°',-90,90,1,0],['tiltY','Inclinação Y','°',-90,90,1,0],['gyroZ','Giro Z','°/s',-250,250,1,0]]},
  {type:'ds3231',name:'Relógio RTC DS3231',category:'Sensores',tag:'DS3231',width:104,height:72,icon:'custom',pins:[['VCC',0,18],['GND',0,52],['SCL',104,24],['SDA',104,48]],description:'Relógio de tempo real com temperatura no I²C 0x68.',kind:'sensor',module:true,i2c:{cls:'Ds3231',addr:0x68},controls:[['temperature','Temperatura','°C',-20,60,0.25,25]]},
  {type:'bh1750',name:'Luz BH1750',category:'Sensores',tag:'BH1750',width:104,height:72,icon:'custom',pins:[['VCC',0,18],['GND',0,52],['SCL',104,24],['SDA',104,48]],description:'Sensor de luminosidade em lux no I²C 0x23.',kind:'sensor',module:true,i2c:{cls:'Bh1750',addr:0x23},controls:[['lux','Luz','lx',0,5000,1,320]]},
  {type:'dht22',name:'Sensor DHT22',category:'Sensores',tag:'DHT22',width:70,height:96,icon:'custom',pins:[['VCC',0,20],['DATA',0,40],['NC',0,60],['GND',0,80]],description:'Temperatura e umidade (AM2302) em um fio de dados.',kind:'sensor',onewire:{cls:'Dht',type:22,pin:'DATA'},controls:[['temperature','Temperatura','°C',-40,80,0.1,24],['humidity','Umidade','%',0,100,0.1,55]]},
  {type:'dht11',name:'Sensor DHT11',category:'Sensores',tag:'DHT11',width:70,height:96,icon:'custom',pins:[['VCC',0,20],['DATA',0,40],['NC',0,60],['GND',0,80]],description:'Temperatura e umidade básicas em um fio de dados.',kind:'sensor',onewire:{cls:'Dht',type:11,pin:'DATA'},controls:[['temperature','Temperatura','°C',0,50,1,24],['humidity','Umidade','%',20,90,1,55]]},
  {type:'oled',name:'Display OLED 128×64',category:'Displays',tag:'OLED',width:112,height:84,icon:'custom',pins:[['GND',0,18],['VCC',0,40],['SCL',112,28],['SDA',112,52]],description:'SSD1306 I²C (0x3C). Funciona com firmware real (Adafruit SSD1306).',kind:'display',i2c:{cls:'Ssd1306',addr:0x3c}},
  {type:'neostrip',name:'Fita NeoPixel 8',category:'Displays',tag:'WS2812',width:200,height:44,icon:'custom',pins:[['GND',0,10],['VCC',0,22],['DIN',0,34],['DOUT',200,22]],description:'8 LEDs WS2812B endereçáveis. Funciona com firmware real (Adafruit NeoPixel, FastLED).',kind:'display'},
  {type:'neopixel',name:'NeoPixel RGB',category:'Displays',tag:'LED',width:92,height:76,icon:'custom',pins:[['VCC',0,18],['GND',0,56],['DIN',92,28],['DOUT',92,52]],description:'LED WS2812B endereçável. Com firmware real, a cor vem do protocolo no DIN; DOUT encadeia o próximo.',kind:'display'},
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
let zoom=1, panX=0, panY=0, activeTool='select', simulationTimer=null;
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
function modelStatus(def){
  if(!def)return null;const k=def.kind,t=def.type;
  if(t==='uno')return{sim:true,text:'Simulado: saídas D0–D13 vêm do sketch ou do firmware (.hex).'};
  if(t==='mega')return{sim:true,text:'Simulado: ATmega2560 com firmware (.hex) — 54 digitais, A0–A15, Serial1–3, I²C no D20/D21, SPI no D50–D53.'};
  if(t==='led'||t==='buzzer')return{sim:true,text:t==='led'?'Simulado: liga quando há tensão no sentido certo. Com firmware, o PWM (analogWrite) controla o brilho.':'Simulado: liga com tensão; com firmware, tone() toca a frequência real no alto-falante.'};
  if(k==='conductor')return{sim:true,text:'Simulado como condutor ideal: liga os dois terminais, sem queda de tensão.'};
  if(k==='switch')return{sim:true,text:'Simulado: abre e fecha o contato.'};
  if(k==='source'||k==='highRail'||k==='lowRail')return{sim:true,text:'Simulado: referência de 5 V ou 0 V.'};
  if(t==='ldr')return{sim:true,text:'Simulado: resistência do GL5528 pela luz (ajuste abaixo); num divisor, o analogRead lê a tensão de verdade.'};
  if(t==='ultrasonic')return{sim:true,text:'Simulado com firmware: TRIG e ECHO em pinos da placa; o eco dura o tempo de ida e volta do som (ajuste distância e temperatura).'};
  if(t==='capacitor')return{sim:true,text:'Simulado em CC: circuito aberto. Carga, vazamento e falhas ficam na bancada física (studio).'};
  if(t==='diode')return{sim:true,text:'Simulado: conduz de A para K a partir de 0,7 V.'};
  if(t==='transistor')return{sim:true,text:'Simulado como chave: corrente na base (Vbe 0,7 V) liga C–E saturado.'};
  if(t==='relay')return{sim:true,text:'Simulado: com 5 V no VCC, IN aciona a bobina e o COM troca do NC para o NO (clique).'};
  if(t==='rgb')return{sim:true,text:'Simulado: três LEDs (R 1,9 V, G e B 3,0 V) com cátodo comum; o PWM mistura a cor.'};
  if(t==='segment')return{sim:true,text:'Simulado: sete LEDs com cátodo comum no COM; cada segmento acende com corrente.'};
  if(t==='motor')return{sim:true,text:'Simulado: ~10 Ω; gira com a tensão (PWM controla a velocidade, polaridade o sentido).'};
  if(t==='gate')return{sim:true,text:'Simulado: Y = A·B (alto ≥ 3 V, baixo ≤ 1,5 V).'};
  if(def.onewire)return{sim:true,text:`Simulado com firmware: ${def.tag} responde no fio DATA com o protocolo temporizado do datasheet.`};
  if(def.i2c&&def.kind==='sensor')return{sim:true,text:`Simulado com firmware: ${def.tag} no I²C 0x${def.i2c.addr.toString(16).toUpperCase()} (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega). Ajuste as leituras abaixo.`};
  if(t==='neopixel'||t==='neostrip')return{sim:true,text:'Simulado com firmware: as cores são decodificadas do sinal WS2812 no DIN (DOUT segue para o próximo).'};
  if(t==='pot')return{sim:true,text:'Simulado com firmware: a posição vira tensão no pino analógico ligado ao SIG (analogRead).'};
  if(t==='servo')return{sim:true,text:'Simulado com firmware: o ângulo vem da largura do pulso no SIG (biblioteca Servo).'};
  if(t==='lcd1602')return{sim:true,text:'Simulado com firmware: HD44780 em 4 bits; RS, E e D4–D7 em quaisquer pinos da placa (LiquidCrystal).'};
  if(t==='display')return{sim:true,text:'Simulado com firmware: LCD HD44780 com PCF8574 no I²C 0x27 (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega).'};
  if(t==='oled')return{sim:true,text:'Simulado com firmware: SSD1306 128×64 no I²C 0x3C (SDA/SCL da placa: A4/A5 no Uno, D20/D21 no Mega).'};
  return{sim:false,text:'Só visual: ainda não tem modelo elétrico. Ela entra no desenho e nas conexões, mas não reage à simulação.'};
}
function renderInspector(){
  const view=$('#propertiesView');
  if(!selectedId){view.innerHTML=`<div class="inspector-empty"><div class="inspector-empty-icon">⌁</div><b>Selecione uma peça</b><p>As propriedades do componente aparecem aqui quando você selecionar uma peça no circuito.</p><button class="text-button" id="openCodeFromEmpty">Editar código Arduino →</button></div>`;$('#openCodeFromEmpty')?.addEventListener('click',()=>showInspectorTab('code'));return}
  const part=project.parts.find(item=>item.id===selectedId);if(!part){selectedId=null;return}
  const def=defFor(part.type);if(!def)return;
  const pins=def.pins.map(pin=>`<div class="property-row"><span>${safeText(pin[0])}</span><b>${project.wires.filter(w=>[w.a,w.b].some(end=>end.part===part.id&&end.pin===pin[0])).length?'Conectado':'Livre'}</b></div>`).join('');
  let controls='';
  if(def.kind==='switch')controls=`<div class="property-section"><p class="property-label">Estado do contato</p><div class="switch-row"><span>${part.settings?.pressed?(part.type==='switch'?'Fechado':'Pressionado'):'Aberto'}</span><button id="toggleButtonPart" class="toggle ${part.settings?.pressed?'on':''}" aria-label="Alternar botão"></button></div></div>`;
  if(isBoard(part))controls+=`<div class="property-section"><p class="property-label">Firmware (PlatformIO)</p><div class="property-row"><span>${part.settings?.firmware?safeText(part.settings.firmwareName||'firmware.hex'):'Sketch do editor'}</span><b>${part.settings?.firmware?Math.round(part.settings.firmware.length/1024)+' KB':'—'}</b></div><div class="fw-actions"><button id="fwLoad" class="button button-quiet">Carregar .hex</button>${window.showOpenFilePicker?'<button id="fwWatch" class="button button-quiet" title="Recarrega a cada pio run">Vigiar</button>':''}${part.settings?.firmware?'<button id="fwClear" class="text-button">Remover</button>':''}</div><p class="fw-hint">Arquivo: <code>.pio/build/${ioOf(part).env}/firmware.hex</code> (board = ${ioOf(part).env}). Com firmware, a placa roda o código real do ${ioOf(part).chip}; I²C no ${ioOf(part).sda}/${ioOf(part).scl}.</p></div>`;
  if(def.controls)controls+=`<div class="property-section"><p class="property-label">Leituras do sensor</p>${def.controls.map(([k,label,unit,min,max,step,dflt])=>`<label class="sensor-row"><span>${safeText(label)}</span><b data-sv="${k}">${(part.settings?.sensor?.[k]??dflt)} ${safeText(unit)}</b><input type="range" data-sensor="${k}" min="${min}" max="${max}" step="${step}" value="${part.settings?.sensor?.[k]??dflt}"></label>`).join('')}</div>`;
  if(part.type==='relay')controls+=`<div class="property-section"><p class="property-label">Entrada IN</p><div class="property-row"><span>Aciona com</span><select id="relayTrig"><option ${part.settings?.trigger!=='LOW'?'selected':''}>HIGH</option><option ${part.settings?.trigger==='LOW'?'selected':''}>LOW</option></select></div><p class="fw-hint">Módulos com optoacoplador costumam acionar com LOW.</p></div>`;
  if(part.settings?.warn)controls+=`<div class="property-section"><p class="model-status visual">⚠ ${safeText(part.settings.warn)}</p></div>`;
  if(part.type==='pot')controls+=`<div class="property-section"><p class="property-label">Posição</p><input id="potPos" type="range" min="0" max="1" step="0.01" value="${part.settings?.position??0.5}" style="width:100%"><div class="property-row"><span>Saída</span><b id="potVolts">${((part.settings?.position??0.5)*5).toFixed(2)} V</b></div></div>`;
  if(part.type==='resistor')controls+=`<div class="property-section"><p class="property-label">Valor</p><input id="partValue" class="property-input" value="${safeText(part.settings?.value||'220 Ω')}" /></div>`;
  if(part.type==='led')controls+=`<div class="property-section"><p class="property-label">Cor</p><div class="property-row"><span>Cor do LED</span><input id="ledColor" type="color" value="${safeText(part.settings?.color||'#e56d5c')}" style="width:30px;height:24px;border:0;background:transparent;cursor:pointer" /></div><div class="property-row"><span>Estado</span><b>${part.settings?.lit?'Ligado':'Desligado'}</b></div></div>`;
  view.innerHTML=`<div class="property-header"><div class="property-type">${safeText(def.category)} · ${safeText(def.tag||'COMPONENTE')}</div><h2>${safeText(part.name||def.name)}</h2></div><div class="property-section"><p class="property-label">Identificação</p><label class="property-row"><span>Nome</span><input id="partName" class="property-input" style="width:130px" value="${safeText(part.name||def.name)}" /></label>${def.voltage?`<div class="property-row"><span>Tensão nominal</span><b>${safeText(def.voltage)}</b></div>`:''}</div>${controls}<div class="property-section"><p class="property-label">Terminais</p>${pins}</div><div class="property-section"><p class="property-label">Sobre</p><p style="font-size:9px;line-height:1.55;color:#77827a;margin:0">${safeText(def.description||'Componente personalizado do seu projeto.')}</p>${(()=>{const st=modelStatus(def);return st?`<p class="model-status ${st.sim?'sim':'visual'}">${st.sim?'●':'◇'} ${safeText(st.text)}</p>`:''})()}</div><div class="property-section"><button id="deleteSelectedPart" class="text-button delete-part">Remover componente</button></div>`;
  $('#partName')?.addEventListener('change',event=>{part.name=event.target.value.trim()||def.name;markChanged();renderParts();renderInspector()});
  $('#partValue')?.addEventListener('change',event=>{part.settings.value=event.target.value;markChanged()});
  $('#ledColor')?.addEventListener('input',event=>{part.settings.color=event.target.value;markChanged()});
  $('#toggleButtonPart')?.addEventListener('click',()=>{part.settings.pressed=!part.settings.pressed;markChanged();if(fw){updateSimulation({quiet:true});renderInspector()}else{renderAll();if(simulationTimer)updateSimulation()}});
  $('#deleteSelectedPart')?.addEventListener('click',deleteSelected);
  $('#fwLoad')?.addEventListener('click',()=>{const input=document.createElement('input');input.type='file';input.accept='.hex';input.onchange=async()=>{const f=input.files[0];if(f)setFirmware(part,await f.text(),f.name)};input.click()});
  $('#fwWatch')?.addEventListener('click',async()=>{try{const[h]=await showOpenFilePicker({types:[{description:'Firmware Intel HEX',accept:{'text/plain':['.hex']}}]});watchFirmware(part,h)}catch{}});
  $('#fwClear')?.addEventListener('click',()=>{stopSimulation();delete part.settings.firmware;delete part.settings.firmwareName;markChanged();renderInspector();toast('Firmware removido: o Uno volta ao sketch do editor')});
  document.querySelectorAll('[data-sensor]').forEach(input=>input.addEventListener('input',e=>{const k=e.target.dataset.sensor,unit=def.controls.find(c=>c[0]===k)[2];part.settings.sensor={...(part.settings.sensor||{}),[k]:Number(e.target.value)};document.querySelector(`[data-sv="${k}"]`).textContent=`${e.target.value} ${unit}`;applySensor(part);markChanged()}));
  $('#relayTrig')?.addEventListener('change',e=>{part.settings.trigger=e.target.value;updateSimulation({quiet:true});markChanged()});
  $('#potPos')?.addEventListener('input',e=>{part.settings.position=Number(e.target.value);$('#potVolts').textContent=(part.settings.position*5).toFixed(2)+' V';markChanged()});
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
const UNO_OUT_PINS=['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','A0','A1','A2','A3','A4','A5'];
const MEGA_OUT_PINS=[...Array(54)].map((_,i)=>'D'+i).concat([...Array(16)].map((_,i)=>'A'+i));
// Pinos de cada placa: I²C, SPI, pares TX/RX das seriais e quantas entradas analógicas.
const BOARD_IO={uno:{mcu:'atmega328p',chip:'ATmega328P',pins:UNO_OUT_PINS,sda:'A4',scl:'A5',sck:'D13',mosi:'D11',ss:'D10',serial:[['D1','D0']],analog:6,env:'uno'},mega:{mcu:'atmega2560',chip:'ATmega2560',pins:MEGA_OUT_PINS,sda:'D20',scl:'D21',sck:'D52',mosi:'D51',ss:'D53',serial:[['D1','D0'],['D18','D19'],['D16','D17'],['D14','D15']],analog:16,env:'megaatmega2560'}};
const isBoard=p=>!!BOARD_IO[p?.type],ioOf=p=>BOARD_IO[p.type];
let lastNet=null;
// Circuito em CC (src/editor/circuit.js): resistores com o valor escrito, pinos de saída com 25 Ω, pull-up interno de 35 kΩ,
// LEDs/diodos com Vf, NPN como chave saturada, relé e porta AND. Estados que dependem da própria solução são iterados.
let circuitStates={},lastSolve=null,lastConflict='';
function solveCircuit(){
  const C=window.Circuit;if(!C)return null;const node=(p,pin)=>`${p}:${pin}`;let state=circuitStates,out;
  for(let iter=0;iter<6;iter++){
    const shorts=[],resistors=[],sources=[],diodes=[],tags=[];
    for(const w of project.wires)shorts.push([node(w.a.part,w.a.pin),node(w.b.part,w.b.pin)]);
    for(const p of project.parts){const def=defFor(p.type);if(!def)continue;const n=pin=>node(p.id,pin),s=p.settings||{},led=(a,k,vf,rs,tag)=>{diodes.push({a:n(a),k:n(k),vf,rs});tags.push(tag)};
      if(p.type==='resistor')resistors.push([n(def.pins[0][0]),n(def.pins[1][0]),C.ohms(s.value||'220 Ω')]);
      else if(def.kind==='conductor')shorts.push([n(def.pins[0][0]),n(def.pins[1][0])]);
      else if(p.type==='button'||p.type==='switch'||def.kind==='switch'){if(s.pressed)shorts.push([n(def.pins[0][0]),n(def.pins[1][0])])}
      else if(p.type==='pot'){const pos=Math.max(0,Math.min(1,s.position??0.5));resistors.push([n('VCC'),n('SIG'),1e4*(1-pos)+1],[n('SIG'),n('GND'),1e4*pos+1])}
      else if(p.type==='ldr')resistors.push([n('1'),n('2'),C.ldrOhms(s.sensor?.lux??300)]);
      else if(p.type==='led')led('A','K',C.ledVf(s.color),15,[p,'led']);
      else if(p.type==='rgb')[['R','#ff0000'],['G','#00ff00'],['B','#0000ff']].forEach(([c,col])=>led(c,'COM',C.ledVf(col),15,[p,'rgb',c]));
      else if(p.type==='segment')for(const c of 'ABCDEFG')led(c,'COM',1.9,20,[p,'seg',c]);
      else if(p.type==='diode')led('A','K',0.7,0.5,[p,'diode']);
      else if(p.type==='transistor'){led('B','E',0.7,10,[p,'vbe']);if(state[p.id])resistors.push([n('C'),n('E'),0.5])}
      else if(p.type==='buzzer')resistors.push([n('+'),n('−'),170]);
      else if(p.type==='motor')resistors.push([n('+'),n('−'),10]);
      else if(p.type==='relay'){if(state[p.id])resistors.push([n('VCC'),n('GND'),70]);shorts.push(state[p.id]?[n('COM'),n('NO')]:[n('COM'),n('NC')])}
      else if(p.type==='gate'){if(state[p.id]===0||state[p.id]===1)sources.push({node:n('Y'),volts:state[p.id]*5,r:C.PIN_R})}
      else if(p.type==='source'||def.kind==='source'){const pins=def.pins;sources.push({node:n(p.type==='source'?'+':pins[0][0]),volts:Number(s.voltage)||5,r:0},{node:n(p.type==='source'?'−':pins[1][0]),volts:0,r:0})}
      else if(def.kind==='highRail')sources.push({node:n(def.pins[0][0]),volts:5,r:0});
      else if(def.kind==='lowRail')sources.push({node:n(def.pins[0][0]),volts:0,r:0});
      if(isBoard(p)){sources.push({node:n('5V'),volts:5,r:0},{node:n('GND'),volts:0,r:0});
        for(const label of ioOf(p).pins){if(!pinDef(p,label))continue;const lv=s.outputs?.[label];
          if(lv===0||lv===1)sources.push({node:n(label),volts:5*lv,r:C.PIN_R,pin:[p,label]});else if(s.modes?.[label]==='input_pullup')sources.push({node:n(label),volts:5,r:C.PULLUP_R})}}
    }
    out=C.solve({shorts,resistors,sources,diodes});out.tags=tags;out.sources=sources;
    const next={},V=(p,pin)=>out.volts(node(p.id,pin));
    for(const p of project.parts){
      if(p.type==='transistor'){const i=tags.findIndex(t=>t[0]===p);next[p.id]=out.diodeCurrent[i]>20e-6}
      if(p.type==='relay'){const vcc=V(p,'VCC'),gnd=V(p,'GND'),vin=V(p,'IN'),powered=vcc!==undefined&&gnd!==undefined&&vcc-gnd>=3.5;next[p.id]=powered&&vin!==undefined&&((p.settings?.trigger||'HIGH')==='LOW'?vin-gnd<=1.5:vin-gnd>=2.5)}
      if(p.type==='gate'){const a=C.logicLevel(V(p,'A')),b=C.logicLevel(V(p,'B'));next[p.id]=a===0||b===0?0:a===1&&b===1?1:null}
    }
    const same=Object.keys(next).every(k=>next[k]===state[k]);state=next;if(same)break;
  }
  if(project.parts.some(p=>p.type==='relay'&&!!state[p.id]!==!!circuitStates[p.id]))relayClick();
  circuitStates=state;out.states=state;return out;
}
// Clique curto do contato do relé.
function relayClick(){try{const ac=window._relayAc||(window._relayAc=new AudioContext()),b=ac.createBuffer(1,ac.sampleRate*0.012,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length/5))*0.3;const src=ac.createBufferSource();src.buffer=b;src.connect(ac.destination);src.start()}catch{}}
function updateSimulation(opts={}){
  const nodes=[],edges=[];const node=(part,pin)=>`${part}:${pin}`;
  for(const part of project.parts){for(const[pin]of defFor(part.type)?.pins||[])nodes.push(node(part.id,pin));if(part.type==='resistor'||defFor(part.type)?.kind==='conductor')edges.push([node(part.id,defFor(part.type).pins[0][0]),node(part.id,defFor(part.type).pins[1][0])]);if((['button','switch'].includes(part.type)||defFor(part.type)?.kind==='switch')&&part.settings?.pressed)edges.push([node(part.id,defFor(part.type).pins[0][0]),node(part.id,defFor(part.type).pins[1][0])]);}
  for(const wire of project.wires)edges.push([node(wire.a.part,wire.a.pin),node(wire.b.part,wire.b.pin)]);
  const find=unionFind(nodes,edges);const highs=new Set(),lows=new Set();
  for(const part of project.parts){const definition=defFor(part.type);if(part.type==='source'||definition?.kind==='source'){const pins=definition.pins;highs.add(find(node(part.id,part.type==='source'?'+':pins[0][0])));lows.add(find(node(part.id,part.type==='source'?'−':pins[1][0])))}if(definition?.kind==='highRail')highs.add(find(node(part.id,definition.pins[0][0])));if(definition?.kind==='lowRail')lows.add(find(node(part.id,definition.pins[0][0])));if(isBoard(part)){highs.add(find(node(part.id,'5V')));lows.add(find(node(part.id,'GND')));for(const label of ioOf(part).pins){if(!pinDef(part,label))continue;const level=part.settings?.outputs?.[label];if(level===1)highs.add(find(node(part.id,label)));if(level===0)lows.add(find(node(part.id,label)))} }}
  const lights=[];lastNet={find,node,highs,lows};
  // PWM e tone vindos do firmware: brilho proporcional e buzzer apitando.
  const netDuty=new Map(),netTone=new Map();
  for(const b of project.parts)if(isBoard(b)){for(const[l,d]of Object.entries(b.settings?.duty||{}))netDuty.set(find(node(b.id,l)),d);for(const[l,f]of Object.entries(b.settings?.tone||{}))netTone.set(find(node(b.id,l)),f)}
  // NPN chaveado por PWM: o coletor segue o ciclo de trabalho da base (motor/LED no coletor giram/brilham na mesma fração).
  for(const q of project.parts)if(q.type==='transistor'){const d=netDuty.get(find(node(q.id,'B')));if(d!==undefined)netDuty.set(find(node(q.id,'C')),d)}
  // Valores elétricos pelo solver de CC; o PWM entra como fração do tempo ligado sobre a corrente com o pino em nível alto.
  const sol=solveCircuit();lastSolve=sol;const dutyOf=(p,pins)=>{for(const pin of pins){const d=netDuty.get(find(node(p.id,pin)));if(d!==undefined)return d}return 1};
  if(sol){const mA=i=>sol.diodeCurrent[i]*1e3,V=(p,pin)=>sol.volts(node(p.id,pin));
    for(const part of project.parts){delete part.settings.warn;if(part.type==='rgb')part.settings.rgb=[0,0,0];if(part.type==='segment')part.settings.segs=''}
    sol.tags.forEach(([part,kind,c],i)=>{const cur=mA(i);
      if(kind==='led'){const d=dutyOf(part,['A','K']);part.settings.lit=cur>0.3;part.settings.current=cur*d;part.settings.duty=part.settings.lit?Math.min(1,Math.max(0.25,cur/12))*d:undefined;lights.push(part.settings.lit);if(cur>30)part.settings.warn=`${cur.toFixed(0)} mA no LED (máx. 20 mA contínuos, 30 mA absoluto): falta um resistor de ~220 Ω.`}
      if(kind==='rgb'){const d=dutyOf(part,[c]);part.settings.rgb['RGB'.indexOf(c)]=Math.min(1,cur/10)*d;if(cur>30)part.settings.warn=`${cur.toFixed(0)} mA no ${c}: falta resistor.`}
      if(kind==='seg'&&cur>0.3)part.settings.segs+=c;
      if(kind==='diode')part.settings.lit=cur>0.1;
    });
    for(const part of project.parts){const st=sol.states[part.id];
      if(part.type==='rgb')part.settings.lit=part.settings.rgb.some(x=>x>0.02);
      if(part.type==='segment')part.settings.lit=!!part.settings.segs;
      if(part.type==='transistor'||part.type==='relay')part.settings.on=!!st;
      if(part.type==='gate')part.settings.out=st;
      if(part.type==='motor'){const a=V(part,'+'),b=V(part,'−');const v=a!==undefined&&b!==undefined?a-b:0;part.settings.speed=Math.max(-1,Math.min(1,v/5))*dutyOf(part,['+','−']);part.settings.lit=Math.abs(part.settings.speed)>0.05}
      if(part.type==='buzzer'){const pos=find(node(part.id,'+')),toneHz=netTone.get(pos),a=V(part,'+'),b=V(part,'−');part.settings.tone=toneHz&&b!==undefined&&b<1?toneHz:undefined;part.settings.lit=!!part.settings.tone||(a!==undefined&&b!==undefined&&a-b>=3)}
    }
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
function stopSimulation(){stopFirmware();if(simulationTimer){clearTimeout(simulationTimer);simulationTimer=null}for(const part of project.parts){delete part.settings.duty;delete part.settings.tone;delete part.settings.lines;delete part.settings.glyphs;delete part.settings.rgb;delete part.settings.segs;delete part.settings.speed;delete part.settings.on;delete part.settings.out;delete part.settings.warn;delete part.settings.modes;delete part.settings.current;delete part.settings.angle;delete part.settings.colors}for(const part of project.parts)if(isBoard(part))part.settings.outputs={};updateSimulation();renderAll()}
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
function i2cTargets(board,find,node){
  // Displays e sensores com SDA/SCL nos pinos de I²C desta placa (A4/A5 no Uno, D20/D21 no Mega) entram no barramento.
  const sda=find(node(board.id,ioOf(board).sda)),scl=find(node(board.id,ioOf(board).scl));
  return project.parts.filter(p=>defFor(p.type)?.i2c&&find(node(p.id,'SDA'))===sda&&find(node(p.id,'SCL'))===scl);
}
async function startFirmware(){
  let mod,dev;try{[mod,dev]=await Promise.all([import('./emulator/avr.mjs'),import('./emulator/devices.mjs')])}catch{toast('Não foi possível carregar o emulador (sirva a pasta por HTTP)');return}
  updateSimulation({quiet:true});
  const boards=project.parts.filter(p=>isBoard(p)&&p.settings?.firmware);
  const units=[];
  for(const board of boards){
    // Como o avrdude, recusa firmware compilado para outro chip (a assinatura não bate).
    let mcu;try{const io=ioOf(board),got=mod.detectChip(board.settings.firmware);if(got!==io.mcu)throw Error(`firmware compilado para ${mod.CHIPS[got].name} (${mod.CHIPS[got].board}); esta placa é ${io.chip}. Recompile com board = ${io.env}.`);mcu=mod.createMcu(board.settings.firmware,io.mcu)}catch(e){toast(`${board.name}: ${e.message}`);serialLog(`[${board.name}] ${e.message}\n`);continue}
    const decs=[0,1,2,3].map(()=>new TextDecoder()),unit={board,mcu,devices:null,clock:mod.CLOCK,links:[]};mcu.onSerial=(b,i=0)=>{serialLog(decs[i].decode(new Uint8Array([b]),{stream:true}),unit,i);for(const[from,t,to]of unit.links)if(from===i)t.serialByte(b,to)};
    const devices=[];
    for(const p of i2cTargets(board,lastNet.find,lastNet.node)){const spec=defFor(p.type).i2c,d=new dev[spec.cls]({address:spec.addr,...(spec.cls==='Ds3231'?{start:Date.now()}:{})});mcu.attachI2C(d.address,d);p._device=d;applySensor(p);devices.push([p,d])}
    for(const p of project.parts){const ow=defFor(p.type)?.onewire;if(!ow)continue;const net=lastNet.find(lastNet.node(p.id,ow.pin));const pin=ioOf(board).pins.find(l=>lastNet.find(lastNet.node(board.id,l))===net);if(!pin)continue;const d=new dev[ow.cls]({type:ow.type});mcu.attachPinDevice(pin,d);p._device=d;applySensor(p);devices.push([p,d])}
    // HC-SR04: TRIG e ECHO ligados a pinos desta placa; o ECHO passa a ser dirigido pelo sensor.
    for(const p of project.parts){if(p.type!=='ultrasonic')continue;const pinOf=l=>{const net=lastNet.find(lastNet.node(p.id,l));return ioOf(board).pins.find(x=>lastNet.find(lastNet.node(board.id,x))===net)};const trig=pinOf('TRIG'),echo=pinOf('ECHO');if(!trig||!echo)continue;const d=new dev.HcSr04({echo});mcu.attachPinDevice(trig,d);(unit.driven||=new Set()).add(echo);p._device=d;applySensor(p);devices.push([p,d])}
    // LCD paralelo: descobre em quais pinos da placa estão RS, E e D4–D7 e escuta o E.
    for(const p of project.parts){if(!defFor(p.type)?.parallelLcd)continue;const pinOf=l=>{const net=lastNet.find(lastNet.node(p.id,l));return ioOf(board).pins.find(x=>lastNet.find(lastNet.node(board.id,x))===net)};const rs=pinOf('RS'),en=pinOf('E'),d=['D4','D5','D6','D7'].map(pinOf);if(!rs||!en||d.some(x=>!x))continue;const lcd=new dev.LcdParallel({rs,en,d});mcu.attachPinDevice(en,lcd);devices.push([p,lcd])}
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
  if(!fw)return;const dt=fw.last?Math.min((now-fw.last)/1000,.05):0;fw.last=now;fw.solve=solveCircuit();
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
function applySensor(p){
  const d=p._device,def=defFor(p.type);if(!d||!def?.controls)return;const v=k=>p.settings?.sensor?.[k]??def.controls.find(c=>c[0]===k)[6];
  if(p.type==='mpu6050'){const tx=v('tiltX')*Math.PI/180,ty=v('tiltY')*Math.PI/180;d.accel=[Math.sin(ty),-Math.sin(tx),Math.cos(tx)*Math.cos(ty)];d.gyro=[0,0,v('gyroZ')];return}
  for(const [k]of def.controls)d[k]=v(k);
}
// Entradas do firmware pelo solver: nível lógico pelos limiares do ATmega e tensão real nos pinos analógicos.
function feedInputs(u){
  const sol=fw?.solve||lastSolve;if(!sol)return;const pins=u.mcu.pinSnapshot(),n=l=>`${u.board.id}:${l}`;
  for(const label of ioOf(u.board).pins){const p=pins[label];if(!p||p.mode==='output'||u.mcu.pinDevices.has(label)||u.driven?.has(label))continue;u.mcu.setInput(label,window.Circuit.logicLevel(sol.volts(n(label))))}
  for(let i=0;i<ioOf(u.board).analog;i++){const v=sol.volts(n('A'+i));if(v!==undefined)u.mcu.analog[i]=Math.max(0,Math.min(5,v))}
}
function servoAngles(){
  if(!fw||!lastNet)return;const{find,node}=lastNet;
  for(const s of project.parts.filter(p=>p.type==='servo')){const sig=find(node(s.id,'SIG'));
    for(const u of fw.units)for(const label of ioOf(u.board).pins)if(find(node(u.board.id,label))===sig){const p=u.mcu.pulseInfo(label);if(p&&p.highUs>400&&p.highUs<2600){s.settings.angle=Math.round(Math.max(0,Math.min(180,(p.highUs-544)/(2400-544)*180)))}}}
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
function importProject(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const value=JSON.parse(reader.result);
      if(Array.isArray(value.connections)&&!Array.isArray(value.wires)){toast('Esse arquivo é de outra ferramenta. Importe um projeto exportado pelo Hardware Studio (.json).');return}
      if(!Array.isArray(value.parts)||!Array.isArray(value.wires))throw new Error('invalid');
      snapshot();
      const definitions=normalizeCustomDefinitions(Array.isArray(value.customComponents)?value.customComponents:[]);
      customParts=[...customParts.filter(def=>!definitions.some(next=>next.type===def.type)),...definitions];localStorage.setItem(CUSTOM_KEY,JSON.stringify(customParts));
      const safeParts=value.parts.slice(0,250).map((part,index)=>{
        const def=defFor(part.type);if(!def)return null;
        const raw=part.settings&&typeof part.settings==='object'?part.settings:{};
        const settings={pressed:raw.pressed===true,value:typeof raw.value==='string'?raw.value.slice(0,24):undefined,color:typeof raw.color==='string'&&/^#[\da-f]{6}$/i.test(raw.color)?raw.color:undefined,screen:typeof raw.screen==='string'?raw.screen.slice(0,13):undefined,firmware:typeof raw.firmware==='string'&&raw.firmware.startsWith(':')&&raw.firmware.length<400000?raw.firmware:undefined,firmwareName:typeof raw.firmwareName==='string'?raw.firmwareName.slice(0,60):undefined,position:Number.isFinite(raw.position)?Math.max(0,Math.min(1,raw.position)):undefined,sensor:raw.sensor&&typeof raw.sensor==='object'?Object.fromEntries(Object.entries(raw.sensor).filter(([k,v])=>/^\w{1,20}$/.test(k)&&Number.isFinite(v))):undefined};
        if(raw.outputs&&typeof raw.outputs==='object')settings.outputs=Object.fromEntries(Object.entries(raw.outputs).filter(([pin,level])=>/^D(?:[0-9]|1[0-3])$/.test(pin)&&(level===0||level===1)));
        return{id:String(part.id||`part-${index}`).slice(0,60),type:def.type,name:String(part.name||def.name).slice(0,40),x:Math.max(0,Math.min(1680,Number.isFinite(Number(part.x))?Number(part.x):40)),y:Math.max(0,Math.min(1080,Number.isFinite(Number(part.y))?Number(part.y):40)),settings};
      }).filter(Boolean);
      const ids=new Set(safeParts.map(part=>part.id));
      const safeWires=value.wires.slice(0,1000).filter(wire=>wire&&ids.has(wire.a?.part)&&ids.has(wire.b?.part)&&pinDef(safeParts.find(part=>part.id===wire.a.part),String(wire.a.pin))&&pinDef(safeParts.find(part=>part.id===wire.b.part),String(wire.b.pin))).map((wire,index)=>({id:String(wire.id||`wire-${index}`).slice(0,60),a:{part:String(wire.a.part),pin:String(wire.a.pin)},b:{part:String(wire.b.part),pin:String(wire.b.pin)},...(typeof wire.color==='string'&&/^#[\da-f]{6}$/i.test(wire.color)?{color:wire.color}:{})}));
      project={version:1,title:String(value.title||'Projeto importado').slice(0,80),parts:safeParts,wires:safeWires,code:String(value.code||STARTER_CODE).slice(0,20000)};
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
