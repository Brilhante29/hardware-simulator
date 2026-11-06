import {SCENARIOS,createCapacitorState,stepCapacitor} from '../engine/electrical.mjs';
const $=id=>document.getElementById(id),canvas=$('workshopCanvas'),ctx=canvas.getContext('2d',{alpha:true});
const palette={ink:'#293e34',dark:'#395446',mid:'#678268',light:'#9fb08a',pale:'#dce4c4',cream:'#f3eddb',orange:'#cc7246',rust:'#9c5438',wood:'#bda17a',edge:'#8a785a',lime:'#d4ed86'};
let scenario='nominal',config={...SCENARIOS.find(s=>s.id===scenario).config},state=createCapacitorState(),reading=stepCapacitor(state,config,0),time=0,burstAt=-99,last=0,lastPaint=0,lastUI=0,raf=0,visible=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let motion=!reduced.matches;
const rect=(x,y,w,h,c)=>{ctx.fillStyle=palette[c]||c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
const path=(points,c,w=3)=>{ctx.strokeStyle=palette[c]||c;ctx.lineWidth=w;ctx.lineJoin='miter';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.stroke();};
const poly=(points,c)=>{ctx.fillStyle=palette[c]||c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
const text=(value,x,y,size=10,color='ink')=>{ctx.fillStyle=palette[color]||color;ctx.font=`${size}px Pixelify,monospace`;ctx.fillText(value,Math.round(x),Math.round(y));};
function screw(x,y){rect(x,y,3,3,'edge');rect(x+1,y+1,1,1,'cream');}
function chip(x,y,w=25,h=18){for(let i=3;i<w;i+=5){rect(x+i,y-4,2,4,'light');rect(x+i,y+h,2,4,'light');}rect(x,y,w,h,'ink');rect(x+3,y+3,w-6,h-6,'dark');rect(x+5,y+5,3,3,'light');}
function star(x,y,size=3,color='orange'){rect(x-size,y,size*3,size,color);rect(x,y-size,size,size*3,color);}
function plant(x,y){rect(x,y,22,19,'rust');rect(x-3,y-4,28,5,'orange');rect(x+3,y+4,3,10,'#dd9162');rect(x+9,y-36,3,32,'mid');rect(x-2,y-29,12,8,'dark');rect(x-7,y-34,10,8,'mid');rect(x+11,y-40,10,9,'mid');rect(x+17,y-44,10,8,'light');rect(x+11,y-19,13,7,'dark');rect(x+20,y-24,8,8,'mid');}
function robot(x,y){const bob=motion?Math.round(Math.sin(time*2.6))*2:0;y+=bob;
 rect(x+4,y+39,10,17,'dark');rect(x+31,y+39,10,17,'dark');rect(x,y+53,16,7,'ink');rect(x+29,y+53,17,7,'ink');
 rect(x+6,y+10,34,34,'mid');rect(x+10,y+14,26,25,'pale');rect(x+16,y+21,14,9,'dark');text('H',x+19,y+29,10,'lime');
 rect(x-5,y+17,9,24,'dark');rect(x-8,y+34,9,7,'wood');rect(x+42,y+15,9,20,'dark');rect(x+48,y+11,7,10,'wood');
 rect(x+19,y-22,3,9,'ink');rect(x+16,y-26,9,5,state.fault?'orange':'lime');
 rect(x+2,y-14,42,24,'ink');rect(x+6,y-18,34,4,'mid');rect(x+6,y-10,34,15,'pale');
 const blink=Math.floor(time*2)%11===9;rect(x+13,y-5,5,blink?2:5,'dark');rect(x+28,y-5,5,blink?2:5,'dark');if(state.fault){text('!',x+50,y-18,21,'orange');}
 rect(x+1,y-7,3,7,'orange');rect(x+43,y-7,3,7,'orange');
}
function draw(){
 ctx.clearRect(0,0,560,365);ctx.imageSmoothingEnabled=false;
 // Original, code-drawn pixel art. Integer positions keep the small canvas crisp.
 rect(54,63,449,240,'#e4e7d7');rect(62,55,433,8,'#e4e7d7');rect(46,84,8,207,'#e4e7d7');
 for(let x=65;x<500;x+=17)for(let y=72;y<225;y+=17)rect(x,y,2,2,'#d1d8c0');
 // High window and late afternoon light.
 rect(329,63,146,100,'dark');rect(336,70,132,86,'#c8d5b0');rect(343,77,118,72,'#dde6be');
 rect(430,83,17,17,'#f3e1a1');rect(425,88,27,7,'#f3e1a1');
 poly([[344,135],[357,121],[369,121],[384,103],[397,103],[416,128],[444,115],[461,133],[461,149],[344,149]],'#a3b88d');
 poly([[344,144],[373,134],[400,142],[427,130],[448,137],[461,135],[461,149],[344,149]],'#819e76');
 rect(399,70,6,86,'dark');rect(336,110,132,5,'dark');rect(323,159,158,7,'mid');
 // Components on a shelf.
 rect(66,60,215,7,'wood');rect(66,67,215,4,'edge');rect(79,71,5,13,'edge');rect(261,71,5,13,'edge');
 rect(84,38,28,22,'mid');rect(88,41,20,12,'pale');text('R',95,51,9,'dark');rect(119,32,30,28,'orange');rect(124,37,20,13,'cream');text('C',131,47,9,'rust');
 for(let i=0;i<4;i++){rect(159+i*10,26-i%2*4,7,34+i%2*4,['dark','light','mid','wood'][i]);rect(161+i*10,33,3,2,'cream');}
 rect(216,40,45,20,'dark');chip(225,43,25,13);text('SPARES',215,83,8,'mid');
 // Articulated desk lamp; fixed illumination, moving pixels stay local.
 path([[287,217],[287,141],[269,111],[292,85]],'dark',6);rect(277,214,27,5,'ink');rect(265,105,9,9,'ink');
 poly([[284,77],[306,84],[319,101],[279,89]],'dark');rect(286,89,20,5,'lime');
 ctx.globalAlpha=.13;poly([[286,94],[307,96],[379,216],[226,216]],'#e7c368');ctx.globalAlpha=1;
 // Oscilloscope with an RC trace from the same circuit state.
 rect(77,100,144,78,'edge');rect(82,94,134,79,'light');rect(87,100,91,62,'dark');rect(92,105,81,51,'ink');
 for(let i=0;i<4;i++)rect(94,114+i*11,77,1,'#365447');for(let i=0;i<6;i++)rect(101+i*13,106,1,49,'#365447');
 const scope=[];for(let i=0;i<75;i++){const v=state.fault?0:(1-Math.exp(-Math.min(i/75*.6,state.time)/.1))*Math.min(config.voltage/32,1);scope.push([96+i,150-v*37]);}path(scope,state.fault?'orange':'lime',2);
 const sweep=96+Math.floor((time*22)%73);rect(sweep,108,1,45,'#809c5555');text('C1 / V',98,117,7,'light');
 for(let i=0;i<3;i++){rect(188,105+i*17,13,12,'dark');rect(191,107+i*17,7,7,'pale');}rect(88,165,6,3,'lime');text('SCOPE',102,170,7,'dark');rect(89,178,12,5,'dark');rect(197,178,12,5,'dark');
 // Workbench and stepped shadow.
 rect(50,322,440,8,'#d9dcc9');rect(73,330,396,5,'#e6e7da');rect(53,221,456,15,'edge');rect(45,214,472,12,'wood');rect(45,212,472,4,'#d3bd95');
 for(let i=0;i<12;i++)rect(53+i*38,218,23,1,'#ac916b');
 rect(65,236,15,86,'dark');rect(480,236,15,86,'dark');rect(68,239,5,76,'mid');rect(483,239,5,76,'mid');rect(80,246,399,5,'edge');
 rect(328,236,138,65,'mid');rect(334,241,126,25,'light');rect(334,272,126,24,'light');rect(388,250,22,4,'dark');rect(388,281,22,4,'dark');
 [333,455].forEach(x=>[241,290].forEach(y=>screw(x,y)));rect(412,278,28,15,'cream');text('MIT',416,289,10,'dark');
 // Supply, showing setpoint and source limit.
 rect(153,180,102,30,'edge');rect(150,173,102,35,'pale');rect(156,178,57,20,'ink');text(config.voltage+' V',160,192,12,'lime');
 rect(219,180,12,12,'dark');rect(222,182,6,6,'light');rect(239,179,6,6,'orange');rect(239,192,6,6,'dark');rect(157,202,35,2,'mid');text('200 mA',202,204,7,'dark');
 // PCB, copper traces and the RC load.
 rect(288,199,195,16,'ink');poly([[298,184],[478,184],[487,203],[288,203]],'mid');rect(300,188,176,11,'dark');
 path([[244,183],[262,183],[262,195],[338,195]],'orange',3);path([[447,197],[462,197],[462,209],[267,209],[267,195],[244,195]],'dark',3);
 path([[368,195],[404,195],[404,203],[426,203]],'#d3bf73',3);rect(338,187,32,13,'wood');rect(343,187,3,13,'rust');rect(350,187,3,13,'ink');rect(357,187,3,13,'orange');rect(364,187,2,13,'cream');
 chip(304,189,19,11);text('R1',343,180,8,'dark');
 for(let x=299;x<478;x+=13)rect(x,205,3,3,'light');screw(294,198);screw(479,198);
 if(!state.fault&&Math.abs(reading.current)>.00001){const p=Math.floor(time*18)%70;rect(264+p,193,4,3,'lime');rect(368+Math.floor(time*14)%35,194,3,3,'lime');}
 // Capacitor and its vent. Open failure stays visible until replacement.
 const capX=419,capY=143;rect(capX+5,196,3,8,'light');rect(capX+29,196,3,8,'light');
 rect(capX,capY+5,37,49,state.fault?'#596550':'dark');rect(capX+4,capY+9,7,41,state.fault?'#75826b':'mid');rect(capX+28,capY+6,6,46,'pale');
 for(let y=155;y<191;y+=10)rect(capX+29,y,4,2,'dark');text('100',capX+12,166,9,'cream');text('16V',capX+11,179,9,'cream');rect(capX+4,193,30,4,'ink');
 const elapsed=time-burstAt;
 if(!state.fault){rect(capX-1,capY+2,39,5,'light');rect(capX+3,capY,31,3,'pale');path([[426,146],[445,146]],'mid',1);rect(434,143,2,6,'mid');}
 else{rect(capX+2,capY+5,33,5,'ink');rect(capX+4,capY+1,6,7,'dark');rect(capX+15,capY-3,5,10,'dark');rect(capX+28,capY+2,5,7,'dark');
 const lift=Math.min(elapsed,1);const lidX=capX+6+Math.round(lift*38),lidY=capY-8-Math.round(Math.sin(lift*2.4)*62);rect(lidX,lidY,28,4,'light');rect(lidX+4,lidY-3,20,3,'pale');
 if(elapsed<1.3){for(let i=0;i<9;i++){const a=i*2.399,r=elapsed*52+4;rect(capX+18+Math.cos(a)*r,capY+Math.sin(a)*r-10,3+i%3,3+i%3,i%2?'orange':'#e4b658');}}
 for(let i=0;i<4;i++){const rise=(time*22+i*19)%77;const dx=Math.round(Math.sin(time*2+i)*8);ctx.globalAlpha=(1-rise/88)*.45;rect(capX+8+dx,capY-rise,13+i*3,9+i*2,'#9b9b84');rect(capX+3+dx,capY-rise+5,20+i*2,8,'#9b9b84');}ctx.globalAlpha=1;
 }
 // Companion, loose tools and small lived-in details.
 robot(100,267);rect(182,291,61,28,'orange');rect(187,286,51,7,'rust');path([[199,286],[199,280],[223,280],[223,286]],'dark',4);rect(209,296,6,7,'cream');
 rect(173,214,37,3,'dark');rect(176,210,19,4,'orange');rect(207,215,12,1,'light');
 plant(491,213);rect(52,193,21,20,'cream');rect(55,191,15,3,'dark');path([[73,196],[79,196],[79,207],[73,207]],'wood',3);text('Ω',57,207,10,'orange');
 if(motion){const steam=Math.round(time*10)%16;ctx.globalAlpha=.3;rect(59,180-steam,2,7,'mid');rect(65,175-steam,2,7,'mid');ctx.globalAlpha=1;}
 star(41,121,3,'light');star(512,92,3,'orange');star(253,37,2,'light');text('GOOD IDEAS START HERE',196,344,8,'mid');
}
function updateUI(){const f=(n,d=2)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});$('voltageValue').textContent=f(reading.terminalVoltage)+' V';$('currentValue').textContent=f(reading.current*1000)+' mA';$('powerValue').textContent=reading.resistorPower>=1?f(reading.resistorPower)+' W':f(reading.resistorPower*1000,1)+' mW';$('voltageLabel').textContent=state.fault?'NOS TERMINAIS ABERTOS':'NO CAPACITOR';
 const feedback=state.fault?'C1 abriu. A corrente parou — e R1 deixou de dissipar potência.':reading.terminalVoltage>16?'Passou de 16 V. Há estresse elétrico; o modo de falha exige outro modelo.':'A corrente carrega o capacitor. Acompanhe a tensão subir.';
 if($('sceneFeedback').textContent!==feedback)$('sceneFeedback').textContent=feedback;
 $('sceneFeedback').classList.toggle('failed',!!state.fault);$('sceneBadge').classList.toggle('failed',!!state.fault);const badge=state.fault?'C1: CIRCUITO ABERTO':reading.terminalVoltage>16?'LIMITE ULTRAPASSADO':'CIRCUITO VIVO';if($('sceneBadge').textContent.trim()!==badge)$('sceneBadge').innerHTML='<i></i>'+badge;
}
function advance(dt){const before=state.fault;reading=stepCapacitor(state,config,dt);if(!before&&state.fault)burstAt=time;}
function tick(now){raf=0;if(!motion||!visible||document.hidden)return;if(!last)last=now;const dt=Math.min((now-last)/1000,.1);last=now;time+=dt;advance(dt*(scenario==='extreme'?.006:.08));if(now-lastPaint>=1000/24){draw();lastPaint=now;}if(now-lastUI>=160){updateUI();lastUI=now;}raf=requestAnimationFrame(tick);}
function schedule(){cancelAnimationFrame(raf);last=0;if(motion&&visible&&!document.hidden)raf=requestAnimationFrame(tick);}
function select(id){const selected=SCENARIOS.find(s=>s.id===id);if(!selected)return;scenario=id;config={...selected.config};state=createCapacitorState();burstAt=-99;reading=stepCapacitor(state,config,0);document.querySelectorAll('[data-scenario]').forEach(b=>{const active=b.dataset.scenario===id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});if(!motion)advance(.8);draw();updateUI();schedule();}
function syncMotion(){document.body.classList.toggle('no-motion',!motion);$('motionToggle').setAttribute('aria-pressed',String(motion));$('motionToggle').setAttribute('aria-label',motion?'Pausar animações':'Ativar animações');$('motionToggle').innerHTML=motion?'Ⅱ <span>Pausar movimento</span>':'▶ <span>Ativar movimento</span>';schedule();draw();}
document.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>select(b.dataset.scenario));$('restore').onclick=()=>select('nominal');$('motionToggle').onclick=()=>{motion=!motion;syncMotion();};reduced.addEventListener('change',()=>{motion=!reduced.matches;syncMotion();});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();},{threshold:.05}).observe(canvas);document.addEventListener('visibilitychange',schedule);window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));window.addEventListener('pageshow',schedule);document.fonts.ready.then(draw);if(!motion)advance(.8);updateUI();syncMotion();
