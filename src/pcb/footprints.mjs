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

// Peça do editor → footprint, prefixo de referência e sugestão de peça LCSC (confira o estoque antes de pedir).
const MODULE_PINS = { oled: ['GND', 'VCC', 'SCL', 'SDA'], display: ['GND', 'VCC', 'SDA', 'SCL'], ds3231: ['VCC', 'GND', 'SCL', 'SDA'], mpu6050: ['VCC', 'GND', 'SCL', 'SDA'], bme280: ['VCC', 'GND', 'SCL', 'SDA'], bh1750: ['VCC', 'GND', 'SCL', 'SDA'], gc9a01: ['GND', 'VCC', 'SCL', 'SDA', 'RES', 'DC', 'CS', 'BLK'], max30102: ['VIN', 'SDA', 'SCL', 'INT', 'GND'] };
export function footprintFor(part, usedPins) {
  const t = part.type, v = String(part.settings?.value || '');
  switch (t) {
    case 'atmega328': return { fp: FOOTPRINTS.TQFP32, ref: 'U', value: 'ATmega328P-AU', lcsc: 'C14877' };
    case 'nano': return { fp: FOOTPRINTS.NANO, ref: 'A', value: 'Arduino Nano', lcsc: '' };
    case 'resistor': return { fp: FOOTPRINTS.R_0805, ref: 'R', value: v || '220 Ω', lcsc: { '10 kΩ': 'C17414', '1 kΩ': 'C17513', '220 Ω': 'C17557', '4,7 kΩ': 'C17673' }[v] || '' };
    case 'capacitor': return { fp: FOOTPRINTS.C_0805, ref: 'C', value: v || '100 µF', lcsc: { '100 nF': 'C49678', '22 pF': 'C1804', '10 µF': 'C15850' }[v] || '' };
    case 'led': return { fp: FOOTPRINTS.LED_0805, ref: 'D', value: 'LED', lcsc: '' };
    case 'diode': return { fp: FOOTPRINTS.SOD123, ref: 'D', value: '1N4148W', lcsc: 'C81598' };
    case 'transistor': return { fp: FOOTPRINTS.SOT23, ref: 'Q', value: 'MMBT3904', lcsc: 'C20526' };
    case 'crystal': return { fp: FOOTPRINTS.XTAL_3225, ref: 'Y', value: '16 MHz', lcsc: '' };
    case 'button': return { fp: FOOTPRINTS.SW_6x6, ref: 'SW', value: 'Tactile 6×6', lcsc: '' };
    case 'motor': return { fp: FOOTPRINTS.MOTOR_PADS, ref: 'M', value: 'Motor de vibração 10 mm', lcsc: '' };
    case 'source': return { fp: FOOTPRINTS.JST_PH2, ref: 'BT', value: 'Bateria Li-ion (JST-PH)', lcsc: 'C131337' };
    case 'buzzer': return { fp: FOOTPRINTS.BUZZER_12, ref: 'BZ', value: 'Buzzer', lcsc: '' };
    default: {
      // Módulo ou peça sem footprint próprio: vira conector 1×N para a placa do módulo (placa filha), na ordem dos pinos dele.
      const pins = MODULE_PINS[t] || usedPins; if (!pins.length) return null;
      return { fp: headerFootprint(pins), ref: 'J', value: `Conector ${part.name || t}`, lcsc: '', module: true };
    }
  }
}
export const NO_FOOTPRINT = new Set(['vcc', 'gnd']); // trilhos viram nomes de rede (+5V, GND)
export const NEEDS_MODULE = new Set(['uno', 'mega']);
