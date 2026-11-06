import {DEFAULTS,advanceRC,createCapacitorState,stepCapacitor,solveLED,resistorLimit,injectFailure,validateConfig} from '../src/engine/electrical.mjs';
export function runElectricalTests(){
 const results=[];const test=(name,source,fn)=>{try{fn();results.push({name,source,pass:true});}catch(e){results.push({name,source,pass:false,error:e.message});}};
 const eq=(a,b,e=1e-9)=>{if(Math.abs(a-b)>e)throw Error(`${a} ≠ ${b}`);};const ok=x=>{if(!x)throw Error('Condição não atendida');};
 test('RC: 63,212% da tensão após uma constante de tempo','Lei RC',()=>eq(advanceRC(0,12,1000,0.0001,0.2,0.1),7.585446705942692));
 test('RC: dividir o passo mantém o mesmo resultado','Lei RC',()=>{let v=0;for(let i=0;i<100;i++)v=advanceRC(v,12,1000,0.0001,0.2,0.001);eq(v,advanceRC(0,12,1000,0.0001,0.2,0.1));});
 test('Carga limitada: dV = I·dt/C e transição contínua','Lei de carga',()=>{eq(advanceRC(0,12,1000,0.0001,0.001,0.5),5);eq(advanceRC(0,12,1000,0.0001,0.001,1.1),11);eq(advanceRC(0,12,1000,0.0001,0.001,1.2),12-Math.exp(-1));});
 test('Energia: 100 μF a 12 V armazena 7,2 mJ','E = CV²/2',()=>{const s=createCapacitorState();const m=stepCapacitor(s,DEFAULTS,10);eq(m.energy,0.0072);});
 test('100× a tensão não cria energia antes de carregar','Lei de carga',()=>{const s=createCapacitorState();const m=stepCapacitor(s,{...DEFAULTS,voltage:1600},0);eq(m.energy,0);eq(m.current,0.2);ok(!s.fault);});
 test('Ruptura aberta: corrente e potência do resistor caem a zero','Injeção de falha',()=>{const s=createCapacitorState(),c={...DEFAULTS,voltage:1600,destructive:true};const m=stepCapacitor(s,c,0.02);ok(s.fault==='open');eq(m.current,0);eq(m.resistorPower,0);ok(s.event.energyBefore>0);});
 test('Ruptura em curto: fonte limita a 200 mA e R dissipa 40 W','Injeção + Ohm',()=>{const s=createCapacitorState(),c={...DEFAULTS,voltage:1600,destructive:true,failureMode:'short'};const m=stepCapacitor(s,c,0.02);eq(m.current,0.2);eq(m.resistorPower,40);eq(m.sourceVoltage,200);ok(m.limited);ok(m.issues.some(i=>i.code==='resistor-power'));});
 test('Sobretensão avisa sem inventar falha automática','Nichicon §2-3',()=>{const s=createCapacitorState();const m=stepCapacitor(s,{...DEFAULTS,voltage:32},2);ok(!s.fault);ok(m.issues.some(i=>i.code==='capacitor-voltage'));});
 test('LED 5 V / 330 Ω: 9,394 mA e balanço de potência','Kingbright p.2 + Ohm',()=>{const m=solveLED({...DEFAULTS,voltage:5,resistance:330});eq(m.current,3.1/330);eq(m.sourcePower,m.resistorPower+m.ledPower);ok(!m.issues.length);});
 test('LED 12 V / 100 Ω: LED e resistor excedem seus limites','Kingbright + Vishay',()=>{const m=solveLED({...DEFAULTS,voltage:12,resistance:100});eq(m.current,0.101);ok(m.issues.some(i=>i.code==='led-current'));ok(m.issues.some(i=>i.code==='resistor-power'));});
 test('Limitar a fonte protege simultaneamente LED e resistor','Correlação do circuito',()=>{const m=solveLED({...DEFAULTS,voltage:12,resistance:100,currentLimitMa:10});eq(m.current,0.01);eq(m.sourceVoltage,2.9);ok(m.limited);ok(!m.issues.length);});
 test('LED invertido: 5 V é o limite; 12 V gera alerta','Kingbright p.2',()=>{ok(!solveLED({...DEFAULTS,voltage:5,ledMode:'reverse'}).issues.length);ok(solveLED({...DEFAULTS,voltage:12,ledMode:'reverse'}).issues.some(i=>i.code==='led-reverse'));});
 test('SFR25: 0,4 W a 70 °C; metade a 112,5 °C; zero a 155 °C','Vishay p.1,3',()=>{eq(resistorLimit(70),0.4);eq(resistorLimit(112.5),0.2);eq(resistorLimit(155),0);});
 test('Entrada inválida é rejeitada sem produzir NaN','Contrato',()=>{for(const resistance of [0,-1,NaN,Infinity,'100']){let rejected=false;try{validateConfig({resistance});}catch{rejected=true;}ok(rejected);}});
 test('LED: monotonicidade e conservação em 500 configurações','Propriedades físicas',()=>{let prev=0;for(let i=0;i<500;i++){const m=solveLED({...DEFAULTS,voltage:i/20,resistance:330});ok(m.current>=prev);prev=m.current;eq(m.sourcePower,m.resistorPower+m.ledPower);}});
 test('Falha persiste até trocar/resetar o componente','Estado do modelo',()=>{const s=createCapacitorState();injectFailure(s,DEFAULTS,'short');stepCapacitor(s,DEFAULTS,1);ok(s.fault==='short');ok(!createCapacitorState().fault);});
 return results;
}
