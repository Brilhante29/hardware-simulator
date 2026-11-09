// Rig sem tela: um circuito salvo (hardware-studio.json) + um firmware (.hex) → chip emulado com as peças ligadas.
// É como as vitrines, os testes e as ferramentas de linha de comando sobem um projeto, sem repetir a fiação à mão.
import { createMcu } from '../emulator/avr.mjs';
import * as emulated from '../emulator/devices.mjs';
import { bindCircuit, applyControls, wireNets } from './bind.mjs';

export function createRig({ hex, circuit, catalog, boardId = null, now = Date.now(), devices = emulated }) {
  const defFor = t => catalog.get(t), net = wireNets(circuit);
  const board = circuit.parts.find(p => boardId ? p.id === boardId : defFor(p.type)?.board);
  if (!board) throw Error('O circuito não tem placa nem chip.');
  const io = defFor(board.type).board, mcu = createMcu(hex, io.mcu);
  const { bound, driven, notes } = bindCircuit({ mcu, board, io, parts: circuit.parts, defFor, net, devices, now });
  for (const { def, part, device } of bound) applyControls(def, part, device);
  const byId = Object.fromEntries(bound.map(b => [b.part.id, b.device]));
  const byType = type => bound.filter(b => b.part.type === type).map(b => b.device);
  const boardPin = (partId, pin) => io.pins.find(l => net(board.id, l) === net(partId, pin));
  return { mcu, board, io, bound, driven, notes, device: id => byId[id], byType, boardPin };
}
