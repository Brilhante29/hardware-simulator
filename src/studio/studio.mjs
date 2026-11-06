import {DEFAULTS,SOURCES,SCENARIOS,validateConfig,createCapacitorState,stepCapacitor,solveLED,injectFailure} from '../engine/electrical.mjs';
import {runElectricalTests} from '../../tests/electrical.mjs';
import {runConformance} from '../../tests/sn74hc595.mjs';
const $=id=>document.getElementById(id), fmt=(n,d=2)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='hardware-studio-v2';
let config={...DEFAULTS}, state=createCapacitorState(),running=false,raf=0,last=0,accumulator=0,lastPaint=0,history=[], measurements=null,tests=[],activeView='bench',activeScenario='nominal',catalog=[],eventRendered=false,motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer,burstTimer,saveTimer;
try{const raw=localStorage.getItem(STORAGE);if(raw)config=validateConfig(JSON.parse(raw));}catch{}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(config));$('saveNote').textContent='Salvo somente neste navegador';}catch{$('saveNote').textContent='Armazenamento indisponível. Exporte seu projeto.';}},200);}
function download(name,text,type='application/json'){const blob=text instanceof Blob?text:new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function pause(completed=false){running=false;cancelAnimationFrame(raf);$('canvasWrap').classList.remove('running');$('runText').textContent=completed?'Repetir':'Simular';$('playIcon').textContent='▶';$('runStatus').classList.remove('running');$('runStatus').innerHTML='<i></i>'+(completed?'Concluído':state.time?'Pausado':'Pronto');}
function reset(){state=createCapacitorState();pause();history=[];eventRendered=false;clearTimeout(burstTimer);$('canvasWrap').classList.remove('ruptured','burst');render();}
function useScenario(id){const s=SCENARIOS.find(x=>x.id===id);if(!s)return;config={...s.config};activeScenario=id;syncControls();reset();save();}
function syncControls(){
 $('voltageInput').value=config.voltage;$('voltageSlider').value=Math.min(48,config.voltage);$('resistanceInput').value=config.resistance;$('limitInput').value=config.currentLimitMa;$('ambientInput').value=config.ambient;$('capInput').value=config.capacitanceUf;$('ratedInput').value=config.ratedVoltage;$('failureSelect').value=config.failureMode;$('ledModeSelect').value=config.ledMode;
 $('scenarioSelect').value=activeScenario;
 const cap=config.kind==='capacitor';$('capControls').hidden=!cap;$('ledControls').hidden=cap;$('capacitorPart').toggleAttribute('hidden',!cap);$('ledPart').toggleAttribute('hidden',cap);
 $('capExperiment').classList.toggle('selected',cap);$('ledExperiment').classList.toggle('selected',!cap);
 $('experimentTitle').innerHTML=cap?'Pequeno componente.<br><span>Grandes consequências.</span>':'Um LED, muitas respostas.<br><span>Encontre o equilíbrio.</span>';
 $('experimentDescription').textContent=cap?'Mude a tensão. Veja a energia. Entenda o que acontece depois.':'Tensão, resistência e corrente: uma mudança afeta o circuito inteiro.';
 $('circuitCaption').textContent=cap?'FONTE → RESISTOR → CAPACITOR':'FONTE → RESISTOR → LED';
 $('circuit').setAttribute('aria-label',cap?'Fonte, resistor e capacitor em série':'Fonte, resistor e LED em série');
 $('modelType').textContent=cap?'Modelo RC analítico · fonte limitada':'Modelo DC · Vf aproximado';
 $('measureOneLabel').textContent=cap?'Tensão no capacitor':'Tensão no LED';$('measureFourLabel').textContent=cap?'Energia armazenada':'Dissipação no LED';$('energyHint').textContent=cap?'E = ½CV²':'P = V × I';
 $('chartTitle').textContent=cap?'Tensão ao longo do tempo':'Corrente ao longo do tempo';$('chartLegend').textContent=cap?'C1':'D1';
 $('schematicLoadLabel').textContent=cap?'C1':'D1';
 $('schematicButton').disabled=!cap;
 if(!cap){$('canvasWrap').classList.remove('schematic');$('schematicButton').classList.remove('active');$('circuitTab').classList.add('active');}
 $('capValueLabel').textContent=config.capacitanceUf+' µF';$('capRatedLabel').textContent=config.ratedVoltage+' V';$('resistorLabel').textContent=config.resistance>=1000?fmt(config.resistance/1000,config.resistance%1000?1:0)+' kΩ':fmt(config.resistance,0)+' Ω';
 $('sourceDisplay').textContent=fmt(config.voltage,config.voltage>=100?0:2);$('supplyLimitText').textContent=config.currentLimitMa+' mA';
}
function measure(dt=0){return config.kind==='capacitor'?stepCapacitor(state,config,dt):solveLED(config);}
function paintChart(){
 const isCap=config.kind==='capacitor',lim=isCap?config.ratedVoltage:30,points=history.length?history:[{t:state.time,v:isCap?measurements.terminalVoltage:measurements.current*1000}];
 const max=Math.max(lim*1.15,...points.map(p=>p.v*1.1),1),end=Math.max(2,state.time),x=t=>48+574*t/end,y=v=>110-90*Math.max(0,v)/max;
 const d=points.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(2)+','+y(p.v).toFixed(2)).join(' ');
 $('chartLine').setAttribute('d',d);$('chartFill').setAttribute('d',d+` L${x(points.at(-1).t)},110 L${x(points[0].t)},110 Z`);
 $('chartLimit').setAttribute('d',`M48 ${y(lim)}H622`);$('chartTop').textContent=fmt(max,max<100?1:0)+(isCap?' V':' mA');$('chartTime').textContent=fmt(end,1)+' s';
}
function render(){
 measurements=measure();const m=measurements,cap=config.kind==='capacitor';
 $('measureOne').innerHTML=fmt(m.terminalVoltage,m.terminalVoltage>=100?0:2)+' <small>V</small>';
 $('measureOne').classList.toggle('danger-value',m.issues.some(i=>i.component===(cap?'C1':'D1'))||!!state.fault);
 $('measureCurrent').innerHTML=fmt(m.current*1000,Math.abs(m.current)>=.1?1:2)+' <small>mA</small>';
 $('measurePower').innerHTML=(m.resistorPower>=1?fmt(m.resistorPower,2)+' <small>W</small>':fmt(m.resistorPower*1000,1)+' <small>mW</small>');
 $('measurePower').classList.toggle('danger-value',m.resistorPower>m.resistorLimit);
 $('measureEnergy').innerHTML=fmt((cap?m.energy:m.ledPower)*1000,2)+(cap?' <small>mJ</small>':' <small>mW</small>');
 $('measureOneHint').textContent=cap?(state.fault==='open'?'Tensão nos terminais abertos':state.fault==='short'?'Terminais em curto':'Nominal: '+config.ratedVoltage+' V'):'Vf típico: 1,9 V / 10 mA';
 $('currentHint').textContent=m.limited?'Fonte em limitação · '+fmt(m.sourceVoltage,1)+' V':'Limite da fonte: '+config.currentLimitMa+' mA';
 $('powerHint').textContent='Contínua: '+fmt(m.resistorLimit*1000,0)+' mW · '+config.ambient+' °C';
 $('simulationTime').textContent='t = '+fmt(state.time,3)+' s';
 $('canvasWrap').classList.toggle('risk-resistor',m.resistorPower>m.resistorLimit);
 document.querySelector('.wire-flow').classList.toggle('current-flow',Math.abs(m.current)>.00001);
 document.querySelector('.wire-flow').style.animationDuration=Math.max(.25,1.5-Math.min(Math.abs(m.current),.1)*10)+'s';
 document.querySelector('.led-halo').style.opacity=!cap&&config.ledMode==='forward'?Math.min(.4,m.current*15):0;
 if(cap&&state.fault&&!eventRendered){eventRendered=true;$('canvasWrap').classList.add('ruptured','burst');clearTimeout(burstTimer);burstTimer=setTimeout(()=>$('canvasWrap').classList.remove('burst'),1700);}
 const danger=!!state.fault||m.issues.length>0;$('insightCard').classList.toggle('danger',danger);
 $('insightEyebrow').textContent=state.fault?'FALHA DIDÁTICA INJETADA':danger?'UM LIMITE FOI ULTRAPASSADO':'EXPERIMENTE SEM MEDO';
 $('insightTitle').textContent=state.fault?(state.fault==='open'?'O circuito abriu.':'O curto mudou tudo.'):danger?(m.issues[0].component==='R1'?'R1 está sob estresse.':cap?'Acima da tensão nominal.':'O LED está sob estresse.'):(cap?'E se a tensão subir?':'A resistência faz diferença.');
 $('insightText').textContent=state.fault?(state.fault==='open'?'A corrente foi interrompida. A fonte continua aplicando tensão aos terminais abertos.':'A corrente passa pela falha. Observe a fonte limitar e a potência aumentar em R1.'):danger?(m.issues[0].message):(cap?'Um capacitor de 16 V pode ser pequeno. Os efeitos de uma sobretensão, nem tanto.':'Reduza a resistência e observe como corrente e potência crescem juntas.');
 $('extremeButton').innerHTML=state.fault?'Substituir componente e reiniciar →':cap?'Testar com 100× a tensão →':'Testar sobrecorrente →';
 const supplyValue=fmt(config.voltage,config.voltage>=100?0:1)+' V';
 const chain=cap?[
 {label:'01 · ESTÍMULO',value:supplyValue+' na fonte',text:'Limite de '+config.currentLimitMa+' mA. '+(config.voltage/config.ratedVoltage>=100?'100× a tensão nominal.':'Fonte configurada.'),alert:config.voltage>config.ratedVoltage},
 {label:'02 · COMPONENTE',value:state.fault?(state.fault==='open'?'C1 falhou aberto':'C1 falhou em curto'):fmt(m.terminalVoltage,2)+' V em C1',text:state.fault?'Modo e instante assumidos pelo cenário.':fmt(m.voltageRatio*100,1)+'% da tensão nominal. E = ½CV².',alert:!!state.fault||m.voltageRatio>1},
 {label:'03 · CONSEQUÊNCIA',value:fmt(m.current*1000,2)+' mA no circuito',text:state.fault==='open'?'I = 0 → potência de R1 = 0.':m.limited?'Fonte limita a corrente. P em R1 = I²R.':'R1 dissipa '+fmt(m.resistorPower*1000,1)+' mW.',alert:m.resistorPower>m.resistorLimit}
 ]:[
 {label:'01 · ESTÍMULO',value:supplyValue+' / '+config.resistance+' Ω',text:'Vf aproximado: 1,9 V. Fonte até '+config.currentLimitMa+' mA.',alert:false},
 {label:'02 · COMPONENTE',value:fmt(m.current*1000,2)+' mA no LED',text:config.ledMode==='reverse'?'Reverso: fuga e avalanche não modeladas.':'I = (Vfonte − Vf) / R, limitada pela fonte.',alert:m.issues.some(i=>i.component==='D1')},
 {label:'03 · CONSEQUÊNCIA',value:fmt(m.resistorPower*1000,1)+' mW em R1',text:'P = I²R · referência contínua: '+fmt(m.resistorLimit*1000,0)+' mW.',alert:m.resistorPower>m.resistorLimit}
 ];
 $('causalChain').innerHTML=chain.map(s=>`<div class="causal-step ${s.alert?'alert':''}"><span class="step-label">${s.label}</span><b>${esc(s.value)}</b><p>${esc(s.text)}</p></div>`).join('');
 $('eventLog').classList.toggle('alert',danger);
 $('eventLog').textContent=state.event?`t = ${fmt(state.event.time,3)} s · ruptura simulada em modo ${state.fault==='open'?'aberto':'curto'}. Energia antes da injeção: ${fmt(state.event.energyBefore*1000,2)} mJ. Instante de falha não previsto por datasheet.`:cap&&config.destructive?'Cenário destrutivo didático armado: injeta a falha ao cruzar a tensão nominal sob uma fonte de 100×. Não modela pressão ou tempo de ruptura.':danger?'Limites excedidos são evidência de estresse. A animação não certifica o modo físico de falha.':'Condição dentro dos limites avaliados pelo modelo simplificado. Consulte as hipóteses em “Ver fontes”.';
 paintChart();
}
function frame(timestamp){
 if(!running)return;if(!last)last=timestamp;
 accumulator+=Math.min((timestamp-last)/1000,.1)*.25;last=timestamp;
 while(accumulator>=.005){if(config.kind==='capacitor')stepCapacitor(state,config,.005);else state.time+=.005;accumulator-=.005;}
 if(timestamp-lastPaint>=1000/30){render();history.push({t:state.time,v:config.kind==='capacitor'?measurements.terminalVoltage:measurements.current*1000});if(history.length>360)history.shift();lastPaint=timestamp;}
 if(state.time>=2){render();pause(true);return;}
 raf=requestAnimationFrame(frame);
}
function run(){if(running){pause();return;}if(state.time>=2)reset();running=true;last=0;lastPaint=0;accumulator=0;$('runStatus').innerHTML='<i></i>Executando';$('runStatus').classList.add('running');$('runText').textContent='Pausar';$('playIcon').textContent='Ⅱ';$('canvasWrap').classList.add('running');if(!history.length)history.push({t:0,v:config.kind==='capacitor'?state.voltage:solveLED(config).current*1000});raf=requestAnimationFrame(frame);}
function showView(name){const valid=['bench','library','tests','code'];activeView=valid.includes(name)?name:'bench';if(activeView!=='bench')pause();document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+activeView);document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===activeView));if(activeView==='library')loadCatalog();}
function catalogURL(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
async function loadCatalog(){if(catalog.length){renderCatalog();return;}try{const r=await fetch('./data/hardware-catalog.json');if(!r.ok)throw Error();const data=await r.json();catalog=data.records;$('catalogCount').textContent=catalog.length;const cats=[...new Set(catalog.map(x=>x.kind))].sort();for(const cat of cats){const o=document.createElement('option');o.value=cat;o.textContent=cat;$('catalogFilter').append(o);}renderCatalog();}catch{$('catalogGrid').textContent='Não foi possível carregar o catálogo. Sirva o projeto por HTTP ou tente atualizar a página.';}}
function renderCatalog(){const query=$('catalogSearch').value.toLowerCase(),kind=$('catalogFilter').value;const filtered=catalog.filter(x=>(!kind||x.kind===kind)&&[x.name,x.id,x.vendor,x.kind].join(' ').toLowerCase().includes(query));$('catalogResultCount').textContent=filtered.length+' itens';$('catalogGrid').innerHTML=filtered.map(x=>{const functional=x.id==='sn74hc595';return `<article class="catalog-item"><span class="catalog-icon">${esc(x.kind==='Board'?'PCB':x.kind==='Sensor'?'SEN':'IC')}</span><h2>${esc(x.name)}</h2><p>${esc(x.vendor)} · ${esc(x.kind)}</p><span class="catalog-status ${functional?'functional':''}">${functional?'MODELO LÓGICO TESTADO':'REFERÊNCIA · MODELO PENDENTE'}</span><a href="${esc(catalogURL(x.officialSource))}" target="_blank" rel="noopener">Documentação do fabricante ↗</a>${functional?'<a href="./lab/sn74hc595.html">Abrir bancada funcional →</a>':''}</article>`;}).join('')||'<p>Nenhum componente encontrado. Experimente outro nome ou fabricante.</p>';}
function showSources(){
 $('sourcesBody').innerHTML=Object.entries(SOURCES).map(([key,s])=>`<div class="source-entry"><h3>${esc(s.name)}</h3><p><a href="${esc(s.url)}" target="_blank" rel="noopener">Documento oficial ↗</a> · ${esc(s.revision)} · ${esc(s.section)}</p><p>${key==='capacitor'?'Capacitância e tensão nominal são parâmetros configuráveis. Curto, abertura e alívio de pressão são mecanismos possíveis; a política de ruptura de 100× é didática.':key==='resistor'?'SFR25: referência de 0,4 W a 70 °C, com redução linear até 155 °C. A indicação de calor usa a potência; não simula combustão.':'WP7113ID: Vf típico de 1,9 V a 10 mA / 25 °C. Limites de corrente, potência e tensão reversa consultados no datasheet.'}</p></div>`).join('')+'<div class="model-limits"><b>O que esta bancada calcula</b><br>Carga RC analítica com limitação de corrente; LED com queda fixa; potência e energia. Sem ESR, fuga, pressão, arcos, emissão de gases ou trajetória de fragmentos. Superar uma referência contínua num pulso não basta para prever dano. A ruptura é uma hipótese de cenário; falhas abertas e em curto são recalculadas no circuito.<br><br><b>Precisão e desempenho</b><br>Motor independente da tela, passo de 5 ms em tempo simulado, atualização visual limitada a 30 Hz, histórico limitado a 360 pontos. Pausa ao ocultar a página; animações respeitam movimento reduzido.</div>';
 $('sourcesDialog').showModal();
}
function runTests(){const start=performance.now();tests=[...runElectricalTests(),...runConformance().map(x=>({...x,source:'TI SCLS041J · §8.1/8.4'}))];const elapsed=performance.now()-start;const pass=tests.filter(t=>t.pass).length;$('testSummary').innerHTML=`<b>${pass}/${tests.length} aprovados</b><span>Executado neste navegador em ${fmt(elapsed,1)} ms. Os 256 bytes do registrador estão incluídos.</span>`;$('testResults').innerHTML=tests.map(t=>`<div class="test-row ${t.pass?'':'fail'}"><span>${t.pass?'✓':'×'}</span><b>${esc(t.name)}${t.error?' · '+esc(t.error):''}</b><small>${esc(t.source)}</small></div>`).join('');$('exportReport').disabled=false;}
const sketch=`// Hardware Studio — SN74HC595 — Arduino Uno
// Modelo lógico: TI SCLS041J, seções 8.1 / 8.4
// D11 → SER, D13 → SRCLK, D10 → RCLK, D9 → OE
// SRCLR → 5V, VCC → 5V, GND comum
// Cada LED nas saídas precisa de resistor apropriado.
#include <Arduino.h>
const uint8_t DATA_PIN = 11, CLOCK_PIN = 13;
const uint8_t LATCH_PIN = 10, OE_PIN = 9;
void setup() {
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(OE_PIN, OUTPUT);
  digitalWrite(OE_PIN, HIGH);
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, 0xA5);
  digitalWrite(LATCH_PIN, HIGH);
  digitalWrite(OE_PIN, LOW);
}
void loop() {}
`;
// Small ZIP STORE writer: portable project export without dependencies or server.
function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zipFiles(files){const chunks=[],central=[];let offset=0,centralSize=0;for(const [path,content] of Object.entries(files)){const name=new TextEncoder().encode(path),data=new TextEncoder().encode(content),crc=crc32(data);const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,0x21,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);centralSize+=c.length;offset+=h.length+data.length;}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
$('scenarioSelect').innerHTML=SCENARIOS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')+'<option value="custom">Personalizado</option>';
activeScenario=SCENARIOS.find(s=>JSON.stringify(s.config)===JSON.stringify(config))?.id||'custom';
$('scenarioSelect').onchange=e=>useScenario(e.target.value);
for(const [id,key] of [['voltageInput','voltage'],['resistanceInput','resistance'],['limitInput','currentLimitMa'],['ambientInput','ambient'],['capInput','capacitanceUf'],['ratedInput','ratedVoltage']])$(id).onchange=e=>{try{config=validateConfig({...config,[key]:Number(e.target.value)});activeScenario='custom';syncControls();render();save();}catch{toast('Valor fora do intervalo permitido.');syncControls();}};
$('voltageSlider').oninput=e=>{config.voltage=Number(e.target.value);activeScenario='custom';syncControls();render();save();};
$('failureSelect').onchange=e=>{config.failureMode=e.target.value;save();};
$('ledModeSelect').onchange=e=>{config.ledMode=e.target.value;activeScenario='custom';syncControls();render();save();};
$('runButton').onclick=run;$('resetButton').onclick=reset;
$('injectButton').onclick=()=>{injectFailure(state,config);render();toast('Falha injetada: '+(state.fault==='open'?'circuito aberto':'curto-circuito'));};
$('extremeButton').onclick=()=>{if(state.fault){reset();return;}useScenario(config.kind==='capacitor'?'extreme':'led-overload');run();};
$('capExperiment').onclick=()=>{location.hash='bench';useScenario('nominal');};$('ledExperiment').onclick=()=>{location.hash='bench';useScenario('led-nominal');};
$('sourceButton').onclick=showSources;$('aboutButton').onclick=showSources;$('closeSources').onclick=()=>$('sourcesDialog').close();
$('sourcesDialog').onclick=e=>{if(e.target===$('sourcesDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('sourcePart').onclick=()=>$('voltageInput').focus();$('resistorPart').onclick=()=>$('resistanceInput').focus();$('capacitorPart').onclick=()=>$('capInput').focus();$('ledPart').onclick=()=>$('ledModeSelect').focus();
for(const id of ['sourcePart','resistorPart','capacitorPart','ledPart'])$(id).onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$(id).dispatchEvent(new MouseEvent('click'));}};
$('schematicButton').onclick=()=>{$('canvasWrap').classList.add('schematic');$('schematicButton').classList.add('active');$('circuitTab').classList.remove('active');};$('circuitTab').onclick=()=>{$('canvasWrap').classList.remove('schematic');$('schematicButton').classList.remove('active');$('circuitTab').classList.add('active');};
function motionUI(){document.body.classList.toggle('no-motion',!motion);$('motionButton').textContent=motion?'Animações ligadas':'Animações desligadas';$('motionButton').setAttribute('aria-pressed',String(motion));}
$('motionButton').onclick=()=>{motion=!motion;motionUI();};
$('catalogSearch').oninput=renderCatalog;$('catalogFilter').onchange=renderCatalog;
$('runTests').onclick=runTests;$('exportReport').onclick=()=>download('hardware-studio-validacao.json',JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),tests,config,sources:SOURCES,scope:'Modelos simplificados. Não certifica hardware físico.'},null,2));
$('exportProject').onclick=()=>{download('hardware-studio-projeto.json',JSON.stringify({schemaVersion:1,application:'hardware-studio',config},null,2));toast('Projeto exportado. Você pode reabrir o JSON nesta bancada.');};
$('importButton').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>200000)throw Error('Arquivo muito grande.');const data=JSON.parse(await f.text());if(data.schemaVersion!==1||data.application!=='hardware-studio'||!data.config)throw Error('Use um projeto exportado por esta bancada.');config=validateConfig(data.config);activeScenario='custom';syncControls();reset();save();toast('Projeto importado.');}catch(err){toast('Não foi possível importar: '+err.message);}finally{e.target.value='';}};
$('codePreview').textContent=sketch;$('downloadArduino').onclick=()=>download('hardware_studio.ino',sketch,'text/plain');$('downloadPIO').onclick=()=>{download('hardware-studio-platformio.zip',zipFiles({'platformio.ini':'[env:uno]\nplatform = atmelavr\nboard = uno\nframework = arduino\nmonitor_speed = 115200\n','src/main.cpp':sketch,'README.md':'# Hardware Studio — exemplo SN74HC595\n\nAbra a pasta no PlatformIO. Execute pio run para compilar. D11 SER, D13 SRCLK, D10 RCLK, D9 OE. SRCLR/VCC 5V e GND comum.\n\nExportado, não compilado pelo simulador. Hardware real exige validação elétrica e resistores para cada LED.\n'}));toast('Projeto PlatformIO exportado.');};
window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>pause());
const requestedScenario=new URLSearchParams(location.search).get('scenario');if(SCENARIOS.some(s=>s.id===requestedScenario))useScenario(requestedScenario);
motionUI();syncControls();render();showView(location.hash.slice(1)||'bench');
