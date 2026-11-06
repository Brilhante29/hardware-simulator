import {DEFAULTS,SOURCES,ASSUMPTIONS,SCENARIOS,validateConfig,createBench,stepBench,injectFailure} from '../engine/physics.mjs';
import {runElectricalTests} from '../../tests/electrical.mjs';
import {runConformance} from '../../tests/sn74hc595.mjs';
const $=id=>document.getElementById(id), fmt=(n,d=2)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='hardware-studio-v2';
let config={...DEFAULTS}, state=createBench(),speed=1,latest=null,finished=false,quiet=0,prevSample=null,running=false,raf=0,last=0,accumulator=0,lastPaint=0,history=[], measurements=null,tests=[],activeView='bench',activeScenario='nominal',catalog=[],eventRendered=false,motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer,burstTimer,saveTimer;
try{const raw=localStorage.getItem(STORAGE);if(raw)config=validateConfig(JSON.parse(raw));}catch{}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(config));$('saveNote').textContent='Salvo somente neste navegador';}catch{$('saveNote').textContent='Armazenamento indisponível. Exporte seu projeto.';}},200);}
function download(name,text,type='application/json'){const blob=text instanceof Blob?text:new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function pause(completed=false){running=false;finished=completed;cancelAnimationFrame(raf);$('canvasWrap').classList.remove('running');$('runText').textContent=completed?'Repetir':'Simular';$('playIcon').textContent='▶';$('runStatus').classList.remove('running');$('runStatus').innerHTML='<i></i>'+(completed?'Concluído':state.time?'Pausado':'Pronto');}
function reset(){state=createBench(config);latest=null;quiet=0;prevSample=null;pause();history=[];eventRendered=false;clearTimeout(burstTimer);$('canvasWrap').classList.remove('ruptured','burst');render();}
function useScenario(id){const s=SCENARIOS.find(x=>x.id===id);if(!s)return;config=validateConfig({...DEFAULTS,...s.config});speed=s.speed||1;activeScenario=id;syncControls();reset();save();}
function syncControls(){
 $('voltageInput').value=config.voltage;$('voltageSlider').value=Math.min(48,config.voltage);$('resistanceInput').value=config.resistance;$('limitInput').value=config.currentLimitMa;$('ambientInput').value=config.ambient;$('capInput').value=config.capacitanceUf;$('ratedInput').value=config.ratedVoltage;$('failureSelect').value=config.failureMode;$('ledModeSelect').value=config.ledMode;
 $('scenarioSelect').value=activeScenario;$('speedSelect').value=String(speed);$('ventBlockedInput').checked=config.ventBlocked;$('capReversedInput').checked=config.capReversed;
 const cap=config.kind==='capacitor';$('capControls').hidden=!cap;$('ledControls').hidden=cap;$('capacitorPart').toggleAttribute('hidden',!cap);$('ledPart').toggleAttribute('hidden',cap);
 $('capExperiment').classList.toggle('selected',cap);$('ledExperiment').classList.toggle('selected',!cap);
 $('experimentTitle').innerHTML=cap?'Pequeno componente.<br><span>Grandes consequências.</span>':'Um LED, muitas respostas.<br><span>Encontre o equilíbrio.</span>';
 $('experimentDescription').textContent=cap?'Mude a tensão. Veja a energia. Entenda o que acontece depois.':'Tensão, resistência e corrente: uma mudança afeta o circuito inteiro.';
 $('circuitCaption').textContent=cap?'FONTE → RESISTOR → CAPACITOR':'FONTE → RESISTOR → LED';
 $('circuit').setAttribute('aria-label',cap?'Fonte, resistor e capacitor em série':'Fonte, resistor e LED em série');
 $('modelType').textContent=cap?'Eletrotérmico · fuga, calor, gás e válvula':'Diodo de Shockley · calor da junção';
 $('measureOneLabel').textContent=cap?'Tensão no capacitor':'Tensão no LED';$('measureFourLabel').textContent=cap?'Energia armazenada':'Dissipação no LED';$('energyHint').textContent=cap?'E = ½CV²':'P = V × I';
 $('chartTitle').textContent=cap?'Tensão ao longo do tempo':'Corrente ao longo do tempo';$('chartLegend').textContent=cap?'C1':'D1';
 $('schematicLoadLabel').textContent=cap?'C1':'D1';
 $('schematicButton').disabled=!cap;
 if(!cap){$('canvasWrap').classList.remove('schematic');$('schematicButton').classList.remove('active');$('circuitTab').classList.add('active');}
 $('capValueLabel').textContent=config.capacitanceUf+' µF';$('capRatedLabel').textContent=config.ratedVoltage+' V';$('resistorLabel').textContent=config.resistance>=1000?fmt(config.resistance/1000,config.resistance%1000?1:0)+' kΩ':fmt(config.resistance,0)+' Ω';
 $('sourceDisplay').textContent=fmt(config.voltage,config.voltage>=100?0:2);$('supplyLimitText').textContent=config.currentLimitMa+' mA';
}
function measure(dt=0){if(dt===0&&latest&&running)return latest;latest=stepBench(state,config,dt);return latest;}
function paintChart(){
 const isCap=config.kind==='capacitor',lim=isCap?config.ratedVoltage:30,points=history.length?history:[{t:state.time,v:isCap?measurements.terminalVoltage:measurements.current*1000}];
 const max=Math.max(lim*1.15,...points.map(p=>p.v*1.1),1),end=Math.max(2,state.time),x=t=>48+574*t/end,y=v=>110-90*Math.max(0,v)/max;
 const d=points.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(2)+','+y(p.v).toFixed(2)).join(' ');
 $('chartLine').setAttribute('d',d);$('chartFill').setAttribute('d',d+` L${x(points.at(-1).t)},110 L${x(points[0].t)},110 Z`);
 $('chartLimit').setAttribute('d',`M48 ${y(lim)}H622`);$('chartTop').textContent=fmt(max,max<100?1:0)+(isCap?' V':' mA');$('chartTime').textContent=fmt(end,1)+' s';
}
function render(){
 measurements=measure();const m=measurements,cap=config.kind==='capacitor',fault=m.fault;paintParts(m);
 $('measureOne').innerHTML=fmt(m.terminalVoltage,m.terminalVoltage>=100?0:2)+' <small>V</small>';
 $('measureOne').classList.toggle('danger-value',m.issues.some(i=>i.component===(cap?'C1':'D1'))||!!fault);
 $('measureCurrent').innerHTML=fmt(m.current*1000,Math.abs(m.current)>=.1?1:2)+' <small>mA</small>';
 $('measurePower').innerHTML=(m.resistorPower>=1?fmt(m.resistorPower,2)+' <small>W</small>':fmt(m.resistorPower*1000,1)+' <small>mW</small>');
 $('measurePower').classList.toggle('danger-value',m.resistorPower>m.resistorLimit);
 $('measureEnergy').innerHTML=fmt((cap?m.energy:m.ledPower)*1000,2)+(cap?' <small>mJ</small>':' <small>mW</small>');
 $('measureOneHint').textContent=cap?(fault==='open'?'C1 aberto (secou)':fault==='short'?'Folhas em curto':fault==='ruptured'?'Lata rompida':'Nominal: '+config.ratedVoltage+' V'+(m.leakage>1e-4?' · fuga '+fmt(m.leakage*1000,1)+' mA':'')):'Vf típico: 1,9 V / 10 mA · Tj '+fmt(m.ledTemperature,0)+' °C';
 $('currentHint').textContent=m.limited?'Fonte em limitação · '+fmt(m.sourceVoltage,1)+' V':'Limite da fonte: '+config.currentLimitMa+' mA';
 $('powerHint').textContent='Contínua: '+fmt(m.resistorLimit*1000,0)+' mW · '+config.ambient+' °C';
 $('simulationTime').textContent='t = '+clock(state.time)+(speed!==1?' · '+(speed<1?'¼':fmt(speed,0))+'× ':'');
 $('canvasWrap').classList.toggle('risk-resistor',m.resistorPower>m.resistorLimit);
 document.querySelector('.wire-flow').classList.toggle('current-flow',Math.abs(m.current)>.00001);
 document.querySelector('.wire-flow').style.animationDuration=Math.max(.25,1.5-Math.min(Math.abs(m.current),.1)*10)+'s';
 document.querySelector('.led-halo').style.opacity=!cap?Math.min(.55,m.brightness*.35):0;
 if(cap&&fault==='ruptured'&&!eventRendered){eventRendered=true;$('canvasWrap').classList.add('ruptured','burst');clearTimeout(burstTimer);burstTimer=setTimeout(()=>$('canvasWrap').classList.remove('burst'),1700);}
 const danger=!!fault||m.issues.length>0;$('insightCard').classList.toggle('danger',danger);
 const lastEv=m.events[m.events.length-1];$('insightEyebrow').textContent=fault||m.resistorOpen?'O QUE ACONTECERIA DE VERDADE':danger?'UM LIMITE FOI ULTRAPASSADO':'EXPERIMENTE SEM MEDO';
 $('insightTitle').textContent=m.resistorOpen&&!fault?'R1 queimou antes.':fault?({open:'C1 abriu a válvula.',short:'C1 em curto.',ruptured:'A lata estourou.'}[fault]||'D1 falhou.'):danger?(m.issues[0].component==='R1'?'R1 está sob estresse.':cap?'Acima da tensão nominal.':'O LED está sob estresse.'):(cap?'E se a tensão subir?':'A resistência faz diferença.');
 $('insightText').textContent=(fault||m.resistorOpen)&&lastEv?lastEv.text:danger?(m.issues[0].message):(cap?'Um capacitor de 16 V pode ser pequeno. Os efeitos de uma sobretensão, nem tanto.':'Reduza a resistência e observe como corrente e potência crescem juntas.');
 $('extremeButton').innerHTML=fault||m.resistorOpen?'Substituir componentes e reiniciar →':cap?'Testar com 100× a tensão →':'Testar sobrecorrente →';
 const supplyValue=fmt(config.voltage,config.voltage>=100?0:1)+' V';
 const chain=cap?[
 {label:'01 · ESTÍMULO',value:supplyValue+' na fonte',text:'Limite de '+config.currentLimitMa+' mA. '+(config.voltage/config.ratedVoltage>=100?'100× a tensão nominal.':'Fonte configurada.'),alert:config.voltage>config.ratedVoltage},
 {label:'02 · COMPONENTE',value:fault?({open:'C1 abriu (válvula)',short:'C1 em curto',ruptured:'C1 rompeu'}[fault]):fmt(m.terminalVoltage,2)+' V em C1',text:fmt(m.capTemperature,0)+' °C · '+fmt(m.pressureKPa,0)+' kPa de pressão interna.',alert:!!fault||m.voltageRatio>1},
 {label:'03 · CONSEQUÊNCIA',value:m.resistorOpen?'R1 aberto':fmt(m.current*1000,2)+' mA no circuito',text:'R1 a '+fmt(m.resistorTemperature,0)+' °C · '+(m.resistorOpen?'sem corrente.':m.limited?'fonte em limitação.':fmt(m.resistorPower*1000,1)+' mW.'),alert:m.resistorPower>m.resistorLimit||m.resistorOpen}
 ]:[
 {label:'01 · ESTÍMULO',value:supplyValue+' / '+config.resistance+' Ω',text:(config.ledMode==='reverse'?'Invertido. ':'')+'Fonte até '+config.currentLimitMa+' mA.',alert:config.ledMode==='reverse'&&config.voltage>5},
 {label:'02 · COMPONENTE',value:fmt(m.current*1000,2)+' mA no LED',text:'Junção a '+fmt(m.ledTemperature,0)+' °C · brilho '+fmt(m.brightness*100,0)+'%.',alert:m.issues.some(i=>i.component==='D1')||!!fault},
 {label:'03 · CONSEQUÊNCIA',value:fmt(m.resistorPower*1000,1)+' mW em R1',text:'P = I²R · referência contínua: '+fmt(m.resistorLimit*1000,0)+' mW.',alert:m.resistorPower>m.resistorLimit}
 ];
 $('causalChain').innerHTML=chain.map(s=>`<div class="causal-step ${s.alert?'alert':''}"><span class="step-label">${s.label}</span><b>${esc(s.value)}</b><p>${esc(s.text)}</p></div>`).join('');
 $('eventLog').classList.toggle('alert',danger);
 $('eventLog').innerHTML=m.events.length?m.events.slice(-4).reverse().map(e=>`<div><b>${clock(e.time)}</b> · ${esc(e.component)} · ${esc(e.text)}</div>`).join(''):'Nada fora do normal até agora. Cada evento aparece aqui com o instante e a fonte.';
 paintChart();
}
function clock(t){if(t<60)return fmt(t,t<10?2:1)+' s';const mm=Math.floor(t/60),ss=Math.floor(t%60);return mm+' min '+String(ss).padStart(2,'0')+' s';}
function sample(m){return [m.current,m.resistorTemperature,m.capTemperature,m.ledTemperature,m.pressureKPa,m.terminalVoltage];}
function frame(timestamp){
 if(!running)return;if(!last)last=timestamp;
 const realDt=Math.min((timestamp-last)/1000,.1);last=timestamp;
 const simDt=realDt*speed,m=stepBench(state,config,simDt);latest=m;
 const now=sample(m);if(prevSample&&simDt>0){const tol=[1e-5,.02,.02,.02,.05,.002];const still=now.every((v,i)=>Math.abs(v-prevSample[i])/simDt<tol[i]*10);quiet=still?quiet+simDt:0;}prevSample=now;
 if(timestamp-lastPaint>=1000/30){render();history.push({t:state.time,v:config.kind==='capacitor'?m.terminalVoltage:m.current*1000});if(history.length>360)history.shift();lastPaint=timestamp;}
 if((state.time>1.5&&quiet>Math.max(1.5,speed*.5))||state.time>=3600){render();pause(true);return;}
 raf=requestAnimationFrame(frame);
}
function run(){if(running){pause();return;}if(finished)reset();running=true;last=0;lastPaint=0;$('runStatus').innerHTML='<i></i>Executando';$('runStatus').classList.add('running');$('runText').textContent='Pausar';$('playIcon').textContent='Ⅱ';$('canvasWrap').classList.add('running');if(!history.length)history.push({t:0,v:0});raf=requestAnimationFrame(frame);}
function paintParts(m){
 const r=$('resistorPart'),c=$('capacitorPart');
 for(const k of ['hot','scorched','smoking','open'])r.classList.toggle(k,m.states.resistor===k||(k==='scorched'&&['smoking','open'].includes(m.states.resistor)));
 r.style.setProperty('--glow',String(Math.max(0,Math.min(.85,(m.resistorTemperature-300)/400))));
 for(const k of ['bulging','vented','ruptured'])c.classList.toggle(k,m.states.capacitor===k);
 c.classList.toggle('warm',m.capTemperature>60);
 const cap=config.kind==='capacitor',bar=(label,value,unit,pct,hot)=>`<div class="${hot?'hot':''}"><span>${label}</span><b>${value} ${unit}</b><i style="--fill:${Math.max(0,Math.min(100,pct)).toFixed(1)}%;--bar:${hot?'var(--danger,#b13532)':'var(--accent,#315acb)'}"></i></div>`;
 $('thermals').innerHTML=bar('R1 · filme',fmt(m.resistorTemperature,0),'°C',m.resistorTemperature/6.5,m.resistorTemperature>155)+(cap?bar('C1 · núcleo',fmt(m.capTemperature,0),'°C',m.capTemperature/1.5,m.capTemperature>85)+bar('C1 · pressão interna',fmt(m.pressureKPa,0),'kPa',m.pressureKPa/5,m.pressureKPa>200):bar('D1 · junção',fmt(m.ledTemperature,0),'°C',m.ledTemperature/3,m.ledTemperature>125)+bar('D1 · brilho',fmt(m.brightness*100,0),'%',m.brightness*62,false));
}
function showView(name){const valid=['bench','library','tests','code'];activeView=valid.includes(name)?name:'bench';if(activeView!=='bench')pause();document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+activeView);document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===activeView));if(activeView==='library')loadCatalog();}
function catalogURL(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
async function loadCatalog(){if(catalog.length){renderCatalog();return;}try{const r=await fetch('./data/hardware-catalog.json');if(!r.ok)throw Error();const data=await r.json();catalog=data.records;$('catalogCount').textContent=catalog.length;const cats=[...new Set(catalog.map(x=>x.kind))].sort();for(const cat of cats){const o=document.createElement('option');o.value=cat;o.textContent=cat;$('catalogFilter').append(o);}renderCatalog();}catch{$('catalogGrid').textContent='Não foi possível carregar o catálogo. Sirva o projeto por HTTP ou tente atualizar a página.';}}
function renderCatalog(){const query=$('catalogSearch').value.toLowerCase(),kind=$('catalogFilter').value;const filtered=catalog.filter(x=>(!kind||x.kind===kind)&&[x.name,x.id,x.vendor,x.kind].join(' ').toLowerCase().includes(query));$('catalogResultCount').textContent=filtered.length+' itens';$('catalogGrid').innerHTML=filtered.map(x=>{const functional=x.id==='sn74hc595';return `<article class="catalog-item"><span class="catalog-icon">${esc(x.kind==='Board'?'PCB':x.kind==='Sensor'?'SEN':'IC')}</span><h2>${esc(x.name)}</h2><p>${esc(x.vendor)} · ${esc(x.kind)}</p><span class="catalog-status ${functional?'functional':''}">${functional?'MODELO LÓGICO TESTADO':'REFERÊNCIA · MODELO PENDENTE'}</span><a href="${esc(catalogURL(x.officialSource))}" target="_blank" rel="noopener">Documentação do fabricante ↗</a>${functional?'<a href="./lab/sn74hc595.html">Abrir bancada funcional →</a>':''}</article>`;}).join('')||'<p>Nenhum componente encontrado. Experimente outro nome ou fabricante.</p>';}
function showSources(){
 $('sourcesBody').innerHTML=Object.values(SOURCES).map(s=>`<div class="source-entry"><h3>${esc(s.name)}</h3><p><a href="${esc(s.url)}" target="_blank" rel="noopener">Documento oficial ↗</a></p><p>${esc(s.facts)}</p></div>`).join('')+'<div class="model-limits"><b>Premissas (não vêm de datasheet)</b><br>'+Object.entries(ASSUMPTIONS).map(([k,a])=>`${esc(k)} = ${esc(a.value)} ${esc(a.unit)} — ${esc(a.why)}`).join('<br>')+'</div>';
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
$('ledModeSelect').onchange=e=>{config.ledMode=e.target.value;activeScenario='custom';syncControls();reset();save();};
$('speedSelect').onchange=e=>{speed=Number(e.target.value);render();};
$('ventBlockedInput').onchange=e=>{config.ventBlocked=e.target.checked;activeScenario='custom';reset();save();};
$('capReversedInput').onchange=e=>{config.capReversed=e.target.checked;activeScenario='custom';reset();save();};
$('runButton').onclick=run;$('resetButton').onclick=reset;
$('injectButton').onclick=()=>{injectFailure(state,config);latest=null;render();toast('Falha injetada: '+(config.failureMode==='open'?'circuito aberto':'curto-circuito'));};
$('extremeButton').onclick=()=>{if(latest&&(latest.fault||latest.resistorOpen)){reset();return;}useScenario(config.kind==='capacitor'?'extreme':'led-overload');run();};
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
