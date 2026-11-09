// O roteamento roda fora da thread da página: a placa continua respondendo enquanto o A* trabalha.
import { designBoard, RULES } from './pcb.mjs';
self.onmessage = ({ data }) => {
  const t = performance.now();
  try { const d = designBoard(data.circuit, data.board, RULES, data.placements || null); self.postMessage({ id: data.id, design: d, ms: performance.now() - t }); }
  catch (e) { self.postMessage({ id: data.id, error: e.message }); }
};
