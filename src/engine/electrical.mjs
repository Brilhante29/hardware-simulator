export const SOURCES = Object.freeze({
  resistor: { name: 'Vishay SFR25', url: 'https://www.vishay.com/docs/28722/sfr25.pdf', revision: '11-Feb-2025', section: 'p. 1, 3', power: 0.4, thermal: 200, maxTemperature: 155 },
  led: { name: 'Kingbright WP7113ID', url: 'https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf', revision: 'V.14A', section: 'p. 2', vf: 1.9, maxCurrent: 0.03, maxPower: 0.075, maxReverse: 5, thermal: 560, maxTemperature: 125 },
  capacitor: { name: 'Eletrolítico paramétrico', url: 'https://www.nichicon.co.jp/english/wp-content/uploads/CAT.8101.pdf', revision: 'CAT.8101H', section: '2-2 e 2-3', note: 'C e tensão nominal são parâmetros do projeto. Mecanismos de falha baseados nas notas Nichicon; sem previsão de ruptura.' }
});
export const DEFAULTS = Object.freeze({ kind: 'capacitor', voltage: 12, resistance: 1000, currentLimitMa: 200, ambient: 25, capacitanceUf: 100, ratedVoltage: 16, ledMode: 'forward', destructive: false, failureMode: 'open' });
export function validateConfig(input) {
  const c = { ...DEFAULTS, ...input };
  for (const [k,min,max] of [['voltage',0,1600],['resistance',1,1000000],['currentLimitMa',1,1000],['ambient',-20,85],['capacitanceUf',1,10000],['ratedVoltage',1,450]]) {
    if (typeof c[k] !== 'number' || !Number.isFinite(c[k]) || c[k] < min || c[k] > max) throw new RangeError(`Valor inválido: ${k}`);
  }
  if (!['capacitor','led'].includes(c.kind) || !['forward','reverse','short','open'].includes(c.ledMode) || !['open','short'].includes(c.failureMode) || typeof c.destructive !== 'boolean') throw new TypeError('Configuração inválida');
  return Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,c[k]]));
}
export const resistorLimit = ambient => SOURCES.resistor.power * Math.max(0,Math.min(1,(155-ambient)/85));
const risk = (component, code, observed, limit, unit, source, message) => ({ component, code, observed, limit, unit, source, message });
function base(c, current, terminalVoltage, sourceVoltage, extra={}) {
  const resistorPower = current * current * c.resistance;
  return {current,terminalVoltage,sourceVoltage,resistorVoltage:current*c.resistance,resistorPower,sourcePower:sourceVoltage*current,resistorLimit:resistorLimit(c.ambient),resistorTemperature:c.ambient+resistorPower*SOURCES.resistor.thermal,limited:sourceVoltage < c.voltage-1e-9,issues:[],...extra};
}
function resistorRisk(c,m) {
  if(m.resistorPower > m.resistorLimit + 1e-12) m.issues.push(risk('R1','resistor-power',m.resistorPower,m.resistorLimit,'W','resistor','Potência instantânea acima da especificação contínua. Duração e curva de pulsos precisam ser avaliadas.'));
}
export function solveLED(input) {
  const c=validateConfig({...input,kind:'led'}), vf=SOURCES.led.vf, limit=c.currentLimitMa/1000;
  const conducting=c.ledMode==='forward'||c.ledMode==='short';
  const drop=c.ledMode==='short'?0:vf;
  const current=conducting?Math.min(limit,Math.max(0,c.voltage-drop)/c.resistance):0;
  const sourceVoltage=conducting&&current>=limit?current*c.resistance+drop:c.voltage;
  const terminalVoltage=current>0?drop:sourceVoltage;
  const ledPower=current*terminalVoltage;
  const m=base(c,current,terminalVoltage,sourceVoltage,{ledPower,ledTemperature:c.ambient+ledPower*SOURCES.led.thermal,voltageRatio:0,energy:0});
  resistorRisk(c,m);
  if(c.ledMode==='forward'&&current>SOURCES.led.maxCurrent+1e-12)m.issues.push(risk('D1','led-current',current,0.03,'A','led','Corrente acima do máximo DC a 25 °C.'));
  if(c.ledMode==='forward'&&ledPower>SOURCES.led.maxPower+1e-12)m.issues.push(risk('D1','led-power',ledPower,0.075,'W','led','Dissipação acima do máximo a 25 °C.'));
  if(c.ledMode==='reverse'&&c.voltage>5)m.issues.push(risk('D1','led-reverse',c.voltage,5,'V','led','Tensão reversa acima do limite. Corrente de ruptura não modelada.'));
  if(c.ledMode==='forward'&&m.ledTemperature>125)m.issues.push(risk('D1','led-temperature',m.ledTemperature,125,'°C','led','Estimativa estacionária de junção acima do limite; montagem altera a resistência térmica.'));
  return m;
}
// Exact analytical RC step, including a constant-current interval. No iterative solver.
export function advanceRC(v0,target,resistance,capacitance,limit,dt) {
  const difference=target-v0, direction=Math.sign(difference), tau=resistance*capacitance;
  const boundary=limit*resistance;
  if(Math.abs(difference)<=boundary) return target+(v0-target)*Math.exp(-dt/tau);
  const linearTime=(Math.abs(difference)-boundary)*capacitance/limit;
  if(dt<=linearTime) return v0+direction*limit*dt/capacitance;
  return target-direction*boundary*Math.exp(-(dt-linearTime)/tau);
}
export function createCapacitorState(){return {time:0,voltage:0,fault:null,event:null};}
export function injectFailure(state,c,mode=c.failureMode) {
  if(state.fault)return;
  if(!['open','short'].includes(mode))throw new TypeError('Modo de falha inválido');
  state.event={time:state.time,voltageBefore:state.voltage,energyBefore:0.5*c.capacitanceUf*1e-6*state.voltage**2,sourceVoltage:c.voltage,mode,cause:'Falha injetada pelo cenário didático; não é previsão do instante ou modo de ruptura.'};
  state.fault=mode;
}
export function stepCapacitor(state,input,dt=0) {
  const c=validateConfig(input);
  if(!Number.isFinite(dt)||dt<0||dt>10)throw new RangeError('Passo inválido');
  const limit=c.currentLimitMa/1000, capacitance=c.capacitanceUf*1e-6;
  if(!state.fault){
    state.voltage=advanceRC(state.voltage,c.voltage,c.resistance,capacitance,limit,dt);
    state.time+=dt;
    // Explicit education policy, NOT a material breakdown law or datasheet threshold.
    if(c.destructive&&c.voltage/c.ratedVoltage>=100&&state.voltage>c.ratedVoltage)injectFailure(state,c);
  }else state.time+=dt;
  const current=state.fault==='open'?0:state.fault==='short'?Math.min(c.voltage/c.resistance,limit):Math.max(-limit,Math.min(limit,(c.voltage-state.voltage)/c.resistance));
  const terminalVoltage=state.fault==='short'?0:state.fault==='open'?c.voltage:state.voltage;
  const sourceVoltage=current*c.resistance+terminalVoltage;
  const energy=state.fault?0:0.5*capacitance*state.voltage**2;
  const m=base(c,current,terminalVoltage,sourceVoltage,{energy,voltageRatio:terminalVoltage/c.ratedVoltage,fault:state.fault,event:state.event,capPower:current*terminalVoltage});
  if(terminalVoltage>c.ratedVoltage)m.issues.push(risk('C1','capacitor-voltage',terminalVoltage,c.ratedVoltage,'V','capacitor','Tensão acima da nominal configurada. Pode haver degradação, curto, abertura ou atuação do alívio de pressão.'));
  resistorRisk(c,m);
  return m;
}
export const SCENARIOS=Object.freeze([
 {id:'nominal',label:'Dentro dos limites',subtitle:'12 V · carga RC',kind:'capacitor',config:{...DEFAULTS}},
 {id:'overvoltage',label:'Sobretensão',subtitle:'32 V em um capacitor de 16 V',kind:'capacitor',config:{...DEFAULTS,voltage:32}},
 {id:'extreme',label:'100× a tensão',subtitle:'1.600 V · ruptura didática',kind:'capacitor',config:{...DEFAULTS,voltage:1600,destructive:true}},
 {id:'led-nominal',label:'LED protegido',subtitle:'5 V · resistor de 330 Ω',kind:'led',config:{...DEFAULTS,kind:'led',voltage:5,resistance:330}},
 {id:'led-overload',label:'LED sobrecarregado',subtitle:'12 V · resistor de 100 Ω',kind:'led',config:{...DEFAULTS,kind:'led',voltage:12,resistance:100}},
 {id:'led-reverse',label:'Polaridade invertida',subtitle:'12 V · tensão reversa',kind:'led',config:{...DEFAULTS,kind:'led',voltage:12,resistance:330,ledMode:'reverse'}}
]);
