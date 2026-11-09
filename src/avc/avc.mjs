// HS-Pulse: o firmware examples/firmware/pulseira-avc roda no ATmega328P emulado; cada linha JSON que ele escreve na
// serial chega aqui como se viesse do módulo BLE. O "edge" desenha Poincaré e tacograma, calcula o CHA₂DS₂-VASc e escreve
// o pré-laudo (modelo determinístico, ou o Llama 3 do Ollama local com os trechos recuperados, como no artigo).
import { createMcu, CLOCK } from '../emulator/avr.mjs';
import { Gc9a01, Max30102, Mpu6050 } from '../emulator/devices.mjs';
import { retrieve, chads, templateReport } from './knowledge.mjs';

const $ = s => document.querySelector(s);
const st = { mcu: null, tft: null, ppg: null, imu: null, walk: false, rr: [], last: null, afSince: null, sos: false, painted: -1, t: 0 };

async function boot() {
  const hex = await (await fetch('examples/firmware/pulseira-avc/pulseira-avc-nano.hex')).text();
  const m = createMcu(hex, 'atmega328p'); let line = '';
  m.onSerial = b => { if (b === 10) { receive(line.trim()); line = ''; } else line += String.fromCharCode(b); };
  st.tft = m.attachPinDevice('D10', new Gc9a01({ cs: 'D10', dc: 'D9', rst: 'D8' }));
  st.ppg = m.attachI2C(0x57, new Max30102({ bpm: 72, spo2: 97, seed: Date.now() & 0xffff }));
  st.imu = m.attachI2C(0x68, new Mpu6050());
  m.setInput('D2', 1); st.mcu = m; requestAnimationFrame(frame);
}
const logLines = [];
function receive(text) {
  if (!text.startsWith('{')) return;
  let msg; try { msg = JSON.parse(text); } catch { return; }
  if (msg.b) { st.rr.push(msg.b); if (st.rr.length > 160) st.rr.shift(); dirty = true; return; }
  logLines.push(text); if (logLines.length > 60) logLines.shift(); logDirty = true;
  if (msg.evt === 'sos') { st.sos = true; status('SOS acionado: verificar sinais de AVC (BE-FAST) e ligar 192 se presentes.', 'alert'); }
  if (msg.evt === 'af_suspeita') status('Ritmo irregular sustentado: suspeita de fibrilação atrial. Confirmar com ECG.', 'alert');
  if (msg.t !== undefined) {
    st.last = msg;
    if (msg.af && st.afSince === null) st.afSince = msg.t; if (!msg.af) st.afSince = null;
    $('#kHr').textContent = msg.hr || '--'; $('#kSpo2').textContent = msg.spo2 ? msg.spo2 + '%' : '--'; $('#kIrr').textContent = msg.irr.toFixed(3); $('#kQ').textContent = msg.q + '%';
    if (!msg.af && !st.sos) status(msg.mov ? 'Movimento: batimentos descartados até o braço parar.' : msg.rr < 24 ? `Coletando batimentos (${msg.rr}/24)…` : 'Ritmo regular.', msg.mov ? 'warn' : 'ok');
  }
}
function status(text, kind) { const el = $('#status'); if (el.textContent !== text) el.textContent = text; el.className = 'status ' + kind; }
let dirty = false, logDirty = false;
const sctx = $('#screen').getContext('2d');
function frame(now) {
  const m = st.mcu, dt = st.t ? Math.min(0.05, (now - st.t) / 1000) : 0; st.t = now;
  if (dt) { if (st.walk) { const k = 1 + 0.5 * Math.max(0, Math.sin(2 * Math.PI * 1.8 * m.time)); st.imu.accel = [0, 0, k]; } m.run(Math.round(dt * CLOCK)); }
  if (st.tft.version !== st.painted) { st.painted = st.tft.version; sctx.putImageData(new ImageData(st.tft.rgba(), 240, 240), 0, 0); }
  if (dirty) { dirty = false; charts(); }
  if (logDirty) { logDirty = false; const el = $('#log'); el.textContent = logLines.join('\n'); el.scrollTop = el.scrollHeight; }
  requestAnimationFrame(frame);
}
function charts() {
  const rr = st.rr, p = $('#poincare').getContext('2d'), W = 300, lo = 300, hi = 1600, X = v => 24 + (v - lo) / (hi - lo) * (W - 34), Y = v => W - 24 - (v - lo) / (hi - lo) * (W - 34);
  p.fillStyle = '#05080b'; p.fillRect(0, 0, W, W); p.strokeStyle = '#223'; p.lineWidth = 1;
  for (let v = 400; v <= 1600; v += 200) { p.beginPath(); p.moveTo(X(v), Y(lo)); p.lineTo(X(v), Y(hi)); p.moveTo(X(lo), Y(v)); p.lineTo(X(hi), Y(v)); p.stroke(); }
  p.strokeStyle = '#335'; p.beginPath(); p.moveTo(X(lo), Y(lo)); p.lineTo(X(hi), Y(hi)); p.stroke();
  p.fillStyle = '#9aa6b2'; p.font = '10px ui-monospace,monospace'; p.fillText('RRₙ (ms)', W - 70, W - 6); p.fillText('RRₙ₊₁', 4, 12);
  const af = !!st.last?.af; p.fillStyle = af ? '#ff6b6b' : '#2bd99f';
  for (let i = 1; i < rr.length; i++) { const a = Math.max(lo, Math.min(hi, rr[i - 1])), b = Math.max(lo, Math.min(hi, rr[i])); p.globalAlpha = 0.35 + 0.65 * i / rr.length; p.beginPath(); p.arc(X(a), Y(b), 3, 0, 7); p.fill(); }
  p.globalAlpha = 1;
  const t = $('#tacho').getContext('2d'), TW = 420, TH = 300, n = Math.min(80, rr.length), seg = rr.slice(-n), ty = v => TH - 20 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (TH - 40);
  t.fillStyle = '#05080b'; t.fillRect(0, 0, TW, TH); t.strokeStyle = '#223'; for (let v = 400; v <= 1600; v += 200) { t.beginPath(); t.moveTo(0, ty(v)); t.lineTo(TW, ty(v)); t.stroke(); }
  t.fillStyle = '#9aa6b2'; t.font = '10px ui-monospace,monospace'; for (let v = 400; v <= 1600; v += 400) t.fillText(v, 4, ty(v) - 3);
  t.strokeStyle = af ? '#ff6b6b' : '#2bd99f'; t.lineWidth = 2; t.beginPath(); seg.forEach((v, i) => { const x = 40 + i * (TW - 50) / Math.max(1, n - 1); i ? t.lineTo(x, ty(v)) : t.moveTo(x, ty(v)); }); t.stroke();
}

// ---------- perfil e pré-laudo ----------
const profile = () => ({ age: +$('#age').value, sex: $('#sex').value, htn: $('#htn').checked, dm: $('#dm').checked, chf: $('#chf').checked, vasc: $('#vasc').checked, stroke: $('#stroke').checked });
function showScore() { const sc = chads(profile()); $('#score').textContent = sc.score; $('#scoreRisk').textContent = `CHA₂DS₂-VA ${sc.va} · risco anual estimado de AVC ~${String(sc.annualRisk).replace('.', ',')} % com FA não tratada (Friberg 2012)`; return sc; }
$('#profile').addEventListener('input', showScore); showScore();
function evidence() { const l = st.last || { hr: 0, spo2: 0, irr: 0, q: 0, af: 0, t: 0 }; return { ...l, af: !!l.af, afSeconds: st.afSince === null ? 0 : l.t - st.afSince + 6, sos: st.sos }; }
function rag(ev) { const q = [ev.af ? 'fa irregular confirmar ecg anticoagulacao risco avc' : 'risco avc escore', ev.sos ? 'sos avc sinais emergencia' : '', ev.q < 60 ? 'qualidade movimento ppg' : '', ev.spo2 && ev.spo2 < 92 ? 'spo2 hipoxemia' : '', ev.hr > 110 ? 'frequencia taquicardia' : ''].join(' '); const docs = retrieve(q, 4); $('#ragList').innerHTML = docs.map(d => `<li><b>${d.fonte}:</b> ${d.texto}</li>`).join(''); return docs; }
$('#report').onclick = () => { const ev = evidence(), p = profile(), sc = showScore(), docs = rag(ev); $('#out').textContent = templateReport(ev, p, sc, docs); };
$('#llm').onclick = async () => {
  const ev = evidence(), p = profile(), sc = showScore(), docs = rag(ev), base = templateReport(ev, p, sc, docs);
  const prompt = `Você é um assistente de cardiologia. Escreva um pré-laudo curto em português para o médico, só com os fatos abaixo, sem inventar exames. Termine lembrando que é triagem e não diagnóstico.\n\nFATOS:\n${base}\n\nTRECHOS DE DIRETRIZES:\n${docs.map(d => `- (${d.fonte}) ${d.texto}`).join('\n')}`;
  $('#out').textContent = 'Consultando o Llama 3 local (Ollama)…';
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
    const r = await fetch('http://localhost:11434/api/generate', { method: 'POST', body: JSON.stringify({ model: 'llama3', prompt, stream: false }), signal: ctl.signal }); clearTimeout(timer);
    if (!r.ok) throw Error(`HTTP ${r.status}`); const j = await r.json(); $('#out').textContent = (j.response || '').trim() + '\n\n— gerado por llama3 local com ' + docs.length + ' trechos recuperados';
  } catch (e) { $('#out').textContent = base + `\n\n(Ollama não respondeu em localhost:11434: ${e.message}. Rode "ollama run llama3" para o pré-laudo com LLM; este é o modelo determinístico.)`; }
};

// ---------- controles da pulseira ----------
document.querySelectorAll('[data-rhythm]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-rhythm]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (st.ppg) st.ppg.rhythm = b.dataset.rhythm; });
const bind = (id, fn) => { const el = $(id); el.oninput = () => fn(el.value); };
bind('#bpm', v => { $('#bpmOut').textContent = `${v} bpm`; if (st.ppg) st.ppg.bpm = +v; });
bind('#spo2', v => { $('#spo2Out').textContent = `${v} %`; if (st.ppg) st.ppg.spo2 = +v; });
$('#walk').onchange = e => { st.walk = e.target.checked; if (st.ppg) st.ppg.motion = st.walk ? 0.8 : 0; if (!st.walk && st.imu) st.imu.accel = [0, 0, 1]; };
$('#finger').onchange = e => { if (st.ppg) st.ppg.finger = e.target.checked; };
$('#sos').onclick = () => { if (!st.mcu) return; st.mcu.setInput('D2', 0); setTimeout(() => st.mcu.setInput('D2', 1), 200); };
boot();
