import { SN74HC595 } from '../src/models/sn74hc595.mjs';
export function runConformance() {
  const results = [];
  const check = (name, fn) => { try { fn(); results.push({name, pass:true}); } catch(e) { results.push({name, pass:false, error:e.message}); } };
  const eq = (a,b) => { if(a !== b) throw Error(`${a} != ${b}`); };
  const send = (m,byte) => { for(let i=7;i>=0;i--) { m.drive({SRCLK:0,SER:(byte>>i)&1}); m.drive({SRCLK:1}); } };
  const latch = m => { m.drive({RCLK:0}); m.drive({RCLK:1}); };
  check('Power-up data is unknown, OE disables outputs',()=>{const m=new SN74HC595(); eq(m.serial,'X'); eq(m.output(0),'Z');m.drive({OE:0});eq(m.output(0),'X');});
  check('All 256 bytes: MSB-first input maps correctly to QA..QH',()=>{for(let value=0;value<256;value++){const m=new SN74HC595();send(m,value);latch(m);m.drive({OE:0});for(let b=0;b<8;b++)eq(m.output(b),(value>>b)&1);eq(m.serial,(value>>7)&1);}});
  check('Shift clocks do not change stored output',()=>{const m=new SN74HC595();send(m,165);latch(m);m.drive({OE:0});send(m,90);eq(m.storage,165);latch(m);eq(m.storage,90);});
  check('Clear is asynchronous and leaves storage unchanged',()=>{const m=new SN74HC595();send(m,255);latch(m);m.drive({SRCLR:0});eq(m.serial,0);eq(m.storage,255);latch(m);eq(m.storage,0);});
  check('OE toggles Z without destroying data or serial output',()=>{const m=new SN74HC595();send(m,255);latch(m);eq(m.output(7),'Z');eq(m.serial,1);m.drive({OE:0});eq(m.output(7),1);m.drive({OE:1});eq(m.output(7),'Z');});
  check('Falling or held clocks never shift',()=>{const m=new SN74HC595();m.drive({SRCLR:0});m.drive({SRCLR:1,SER:1,SRCLK:1});eq(m.shift,1);m.drive({SRCLK:1});m.drive({SRCLK:0});eq(m.shift,1);});
  check('Tied clocks: storage remains one shift behind',()=>{const m=new SN74HC595();m.drive({SRCLR:0});m.drive({SRCLR:1});for(let i=0;i<8;i++){const before=m.shift;m.drive({SRCLK:0,RCLK:0,SER:1});m.drive({SRCLK:1,RCLK:1});eq(m.storage,before);}eq(m.shift,255);eq(m.storage,127);});
  check('Invalid input event is rejected atomically',()=>{const m=new SN74HC595();try{m.drive({SER:1,OE:2});}catch{}eq(m.pins.SER,0);});
  return results;
}
