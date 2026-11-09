// Footprints em milímetros, origem no centro, y para baixo (vista de cima). Cada pad tem o nome do pino da peça no editor,
// então a netlist do circuito vira cobre sem tabela intermediária. Medidas das famílias padrão (IPC-7351 nominal / KiCad).
// pad: { pin, x, y, w, h, shape: 'rect'|'circle', drill? (furo metalizado: o pad existe nas duas camadas) }

const smd2 = (a, b, dx, w, h) => [{ pin: a, x: -dx, y: 0, w, h, shape: 'rect' }, { pin: b, x: dx, y: 0, w, h, shape: 'rect' }];
const header = (pins, pitch = 2.54) => pins.map((pin, i) => ({ pin, x: 0, y: (i - (pins.length - 1) / 2) * pitch, w: 1.7, h: 1.7, shape: i ? 'circle' : 'rect', drill: 1.0 }));

// ATmega328P-AU (TQFP-32, 7 × 7 mm, passo 0,8 mm): pino 1 no alto à esquerda, numeração anti-horária vista de cima.
// Nomes iguais aos do ATmega328P DIP do editor; GND e VCC aparecem em mais de um pad, como no chip.
const TQFP32 = ['D3', 'D4', 'GND', 'VCC', 'GND', 'VCC', 'XTAL1', 'XTAL2', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12',
  'D13', 'AVCC', 'ADC6', 'AREF', 'GND', 'ADC7', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'RESET', 'D0', 'D1', 'D2'];
function tqfp32() {
  const pads = [], c = 4.2, L = 1.4, W = 0.5;
  TQFP32.forEach((pin, i) => {
    const side = Math.floor(i / 8), k = i % 8, o = -2.8 + k * 0.8;
    const at = [[-c, o, L, W], [o, c, W, L], [c, -o, L, W], [-o, -c, W, L]][side];
    pads.push({ pin, num: i + 1, x: at[0], y: at[1], w: at[2], h: at[3], shape: 'rect' });
  });
  return pads;
}

// Arduino Nano (módulo, 18 × 45 mm): duas fileiras de 15 pinos a 15,24 mm.
const NANO_L = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', 'GND', 'VIN'];
const NANO_R = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST2', 'D0', 'D1'];

export const FOOTPRINTS = {
  R_0805: { name: 'R_0805_2012Metric', body: [2.0, 1.25], court: [3.4, 1.9], smd: true, pads: smd2('1', '2', 0.95, 1.0, 1.3) },
  C_0805: { name: 'C_0805_2012Metric', body: [2.0, 1.25], court: [3.4, 1.9], smd: true, pads: smd2('+', '−', 0.95, 1.0, 1.3) },
  LED_0805: { name: 'LED_0805_2012Metric', body: [2.0, 1.25], court: [3.4, 1.9], smd: true, pads: smd2('K', 'A', 0.95, 1.0, 1.3), pin1: 'K' },
  SOD123: { name: 'D_SOD-123', body: [2.7, 1.6], court: [4.6, 2.0], smd: true, pads: smd2('K', 'A', 1.65, 0.9, 1.2), pin1: 'K' },
  SOT23: { name: 'SOT-23', body: [2.9, 1.3], court: [3.4, 3.2], smd: true, pads: [{ pin: 'B', x: -0.95, y: 1.0, w: 0.6, h: 0.9, shape: 'rect' }, { pin: 'E', x: 0.95, y: 1.0, w: 0.6, h: 0.9, shape: 'rect' }, { pin: 'C', x: 0, y: -1.0, w: 0.6, h: 0.9, shape: 'rect' }] },
  XTAL_3225: { name: 'Crystal_SMD_3225-4Pin_3.2x2.5mm', body: [3.2, 2.5], court: [4.4, 3.4], smd: true, pads: [{ pin: '1', x: -1.1, y: 0.8, w: 1.4, h: 1.15, shape: 'rect' }, { pin: 'NC2', x: 1.1, y: 0.8, w: 1.4, h: 1.15, shape: 'rect' }, { pin: '2', x: 1.1, y: -0.8, w: 1.4, h: 1.15, shape: 'rect' }, { pin: 'NC4', x: -1.1, y: -0.8, w: 1.4, h: 1.15, shape: 'rect' }] },
  TQFP32: { name: 'TQFP-32_7x7mm_P0.8mm', body: [7, 7], court: [10.2, 10.2], smd: true, pads: tqfp32() },
  SW_6x6: { name: 'SW_PUSH_6mm (THT)', body: [6, 6], court: [8.6, 6.8], pads: [{ pin: '1', x: -3.25, y: -2.25, w: 1.8, h: 1.8, shape: 'circle', drill: 1.0 }, { pin: '1', x: 3.25, y: -2.25, w: 1.8, h: 1.8, shape: 'circle', drill: 1.0 }, { pin: '2', x: -3.25, y: 2.25, w: 1.8, h: 1.8, shape: 'circle', drill: 1.0 }, { pin: '2', x: 3.25, y: 2.25, w: 1.8, h: 1.8, shape: 'circle', drill: 1.0 }] },
  MOTOR_PADS: { name: 'Vibration motor wire pads', body: [4.6, 2.2], court: [5.4, 2.8], smd: true, pads: smd2('+', '−', 1.5, 1.4, 2.0) },
  JST_PH2: { name: 'JST_PH_S2B-PH-K (THT, 2 mm)', body: [6.0, 4.5], court: [6.8, 5.4], pads: [{ pin: '−', x: -1.0, y: 0, w: 1.2, h: 1.75, shape: 'rect', drill: 0.75 }, { pin: '+', x: 1.0, y: 0, w: 1.2, h: 1.75, shape: 'rect', drill: 0.75 }] },
  BUZZER_12: { name: 'Buzzer_12x9.5_RM7.6', body: [12, 12], court: [12.6, 12.6], round: true, pads: [{ pin: '+', x: -3.8, y: 0, w: 1.8, h: 1.8, shape: 'rect', drill: 1.0 }, { pin: '−', x: 3.8, y: 0, w: 1.8, h: 1.8, shape: 'circle', drill: 1.0 }] },
  NANO: { name: 'Arduino_Nano (módulo)', body: [18, 43.2], court: [18.6, 43.8], pads: [...NANO_L.map((pin, i) => ({ pin, x: -7.62, y: (i - 7) * 2.54, w: 1.7, h: 1.7, shape: i ? 'circle' : 'rect', drill: 1.0 })), ...NANO_R.map((pin, i) => ({ pin, x: 7.62, y: (i - 7) * 2.54, w: 1.7, h: 1.7, shape: 'circle', drill: 1.0 }))] },
};
export const headerFootprint = pins => ({ name: `PinHeader_1x${String(pins.length).padStart(2, '0')}_P2.54mm`, body: [2.54, pins.length * 2.54], court: [3.2, pins.length * 2.54 + 0.6], pads: header(pins), header: true });

// Peça do editor → footprint. O mapeamento mora no catálogo (campo `pcb` de cada peça, src/parts/catalog.js):
//   { fp, ref, value: '$value|padrão', lcsc: 'Cxxxx' | { valor: 'Cxxxx' } }  footprint da biblioteca acima
//   { header: [ordem dos pinos] }                                          módulo pronto → conector 1×N
//   { net: 'GND' }                                                          trilho: vira nome de rede, sem peça
//   { refuse: 'motivo' }                                                    não cabe numa placa própria
// Sem `pcb`, a peça vira conector com os pinos que estão ligados (placa filha), para nada ficar de fora da netlist.
export function footprintFor(part, usedPins, def) {
  const p = def?.pcb;
  if (p?.net) return { net: p.net };
  if (p?.refuse) return { refuse: p.refuse };
  if (p?.header) return { fp: headerFootprint(p.header), ref: 'J', value: `Conector ${part.name || part.type}`, lcsc: '', module: true };
  if (p?.fp) {
    const [, field, dflt] = /^\$(\w+)\|?(.*)$/.exec(p.value || '') || [], value = field ? (part.settings?.[field] || dflt) : p.value;
    const lcsc = typeof p.lcsc === 'object' ? p.lcsc[value] || '' : p.lcsc || '';
    return { fp: FOOTPRINTS[p.fp], ref: p.ref, value, lcsc };
  }
  if (!usedPins.length) return null;
  return { fp: headerFootprint(usedPins), ref: 'J', value: `Conector ${part.name || part.type}`, lcsc: '', module: true };
}
