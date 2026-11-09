// Base de conhecimento do pré-laudo (RAG por palavras-chave). Resumos curtos de diretrizes conhecidas, com a fonte.
// Conferir as versões atuais antes de uso clínico: isto é material de pesquisa e ensino, não protocolo.
export const KNOWLEDGE = [
  { id: 'ecg', tags: ['fa', 'irregular', 'confirmar', 'ecg', 'diagnostico'], fonte: 'ESC 2020/2024, diretriz de fibrilação atrial', texto: 'O diagnóstico de fibrilação atrial exige registro de ECG (12 derivações, ou derivação única por pelo menos 30 s) mostrando ritmo irregular sem ondas P. Alertas de relógios e pulseiras por PPG são triagem e precisam ser confirmados por ECG.' },
  { id: 'chads', tags: ['risco', 'avc', 'escore', 'cha2ds2', 'anticoagulacao'], fonte: 'Lip et al., Chest 2010', texto: 'CHA₂DS₂-VASc soma: insuficiência cardíaca 1, hipertensão 1, idade ≥ 75 anos 2, diabetes 1, AVC/AIT/tromboembolismo prévio 2, doença vascular 1, idade 65–74 anos 1, sexo feminino 1.' },
  { id: 'oac', tags: ['anticoagulacao', 'risco', 'avc', 'fa', 'tratamento'], fonte: 'ESC 2020 (CHA₂DS₂-VASc) e ESC 2024 (CHA₂DS₂-VA)', texto: 'Com FA confirmada, a anticoagulação oral é recomendada quando o escore é ≥ 2 em homens ou ≥ 3 em mulheres e deve ser considerada com 1 (homens) ou 2 (mulheres). A diretriz de 2024 passou a usar o CHA₂DS₂-VA, sem o ponto do sexo. A decisão é médica e pesa também o risco de sangramento.' },
  { id: 'befast', tags: ['sinais', 'emergencia', 'sos'], fonte: 'Campanhas BE-FAST / Ministério da Saúde', texto: 'Sinais de AVC (BE-FAST): perda de equilíbrio, alteração da visão, boca torta, fraqueza em um braço, fala enrolada: ligar 192 (SAMU) imediatamente e anotar o horário de início dos sintomas.' },
  { id: 'ppg', tags: ['qualidade', 'movimento', 'ruido', 'ppg'], fonte: 'Saha et al., Pulse-PPG (IMWUT 2025)', texto: 'O PPG de pulso sofre com movimento, ajuste da pulseira e diferenças individuais. Medidas em repouso são mais confiáveis; modelos treinados com dados de campo buscam robustez a esse ruído em vez de descartá-lo.' },
  { id: 'spo2', tags: ['spo2', 'oxigenio', 'hipoxemia'], fonte: 'FDA, comunicado sobre oxímetros (2021/2024)', texto: 'SpO₂ abaixo de 90 % indica hipoxemia. Oxímetros de pulso têm erro maior com baixa perfusão, movimento e pele mais escura; valores devem ser interpretados com o quadro clínico.' },
  { id: 'taquicardia', tags: ['frequencia', 'taquicardia', 'fa'], fonte: 'ESC 2020', texto: 'FA com frequência ventricular alta (acima de cerca de 110 bpm em repouso) pede controle de frequência e avaliação de sintomas como falta de ar, tontura e dor no peito.' },
];
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Recuperação: pontua cada trecho pelas palavras-chave presentes na consulta.
export function retrieve(query, k = 3) {
  const q = norm(query);
  return KNOWLEDGE.map(d => ({ d, s: d.tags.reduce((n, t) => n + (q.includes(t) ? 1 : 0), 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.d);
}
// CHA₂DS₂-VASc e risco anual aproximado de AVC isquêmico sem anticoagulação (Friberg et al., Eur Heart J 2012).
const RISK = [0.2, 0.6, 2.2, 3.2, 4.8, 7.2, 9.7, 11.2, 10.8, 12.2];
export function chads(p) {
  const s = (p.chf ? 1 : 0) + (p.htn ? 1 : 0) + (p.age >= 75 ? 2 : p.age >= 65 ? 1 : 0) + (p.dm ? 1 : 0) + (p.stroke ? 2 : 0) + (p.vasc ? 1 : 0) + (p.sex === 'f' ? 1 : 0);
  return { score: s, va: s - (p.sex === 'f' ? 1 : 0), annualRisk: RISK[Math.min(9, s)] };
}
// Pré-laudo determinístico (sem LLM): só o que foi medido, com as ressalvas.
export function templateReport(ev, p, sc, docs) {
  const L = [];
  L.push(`Paciente ${p.sex === 'f' ? 'feminina' : 'masculino'}, ${p.age} anos${[p.htn && 'hipertensão', p.dm && 'diabetes', p.chf && 'insuficiência cardíaca', p.vasc && 'doença vascular', p.stroke && 'AVC/AIT prévio'].filter(Boolean).map((x, i, a) => (i ? (i === a.length - 1 ? ' e ' : ', ') : '; ') + x).join('')}.`);
  if (ev.af) L.push(`A pulseira registrou ritmo irregular por ${ev.afSeconds} s (irregularidade ${ev.irr.toFixed(3).replace('.', ',')}, limiar 0,08), FC mediana ${ev.hr} bpm, SpO₂ ${ev.spo2} %, ${ev.q} % dos batimentos com sinal limpo.`);
  else L.push(`Ritmo regular nas últimas janelas (irregularidade ${ev.irr.toFixed(3).replace('.', ',')}), FC ${ev.hr || '--'} bpm, SpO₂ ${ev.spo2 || '--'} %.`);
  L.push(`CHA₂DS₂-VASc ${sc.score} (CHA₂DS₂-VA ${sc.va}): risco anual estimado de AVC isquêmico de ~${sc.annualRisk.toString().replace('.', ',')} % se a FA for confirmada e não tratada.`);
  if (ev.af) L.push('Conduta sugerida para avaliação médica: confirmar com ECG; se confirmada, discutir anticoagulação conforme o escore e o risco de sangramento.');
  if (ev.sos) L.push('O paciente acionou o SOS: verificar sinais de AVC (BE-FAST) e acionar o 192 se presentes.');
  if (ev.spo2 && ev.spo2 < 90) L.push('SpO₂ abaixo de 90 %: verificar hipoxemia.');
  L.push('Triagem automática em sinal de pulso; não substitui diagnóstico médico.');
  if (docs.length) L.push('Referências: ' + docs.map(d => d.fonte).join('; ') + '.');
  return L.join('\n\n');
}
