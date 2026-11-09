# Arquitetura do Hardware Studio (como está construída)

A visão de longo prazo (variantes de SoC, KiCad, SPICE) está em [SIMULATOR_ARCHITECTURE.md](SIMULATOR_ARCHITECTURE.md). Este documento descreve o que existe e as regras que mantêm cada recurso **atômico**: uma peça, um projeto ou um chip novo entra por um lugar só, e todo o resto (editor, PCB, vitrines, VS Code, testes) passa a funcionar com ele sem mudança.

## Camadas

```
 aplicações   editor.html · boot.html · pcb.html · watch.html · avc.html · extensão do VS Code · tools/avr-run.mjs · tools/studio-server.mjs
     │ compõem
 composição   src/core/bind.mjs  circuito → dispositivos emulados (o único caminho; editor, rig e CLI usam o mesmo)
              src/core/rig.mjs   circuito + firmware → chip pronto, sem tela (vitrines, testes, linha de comando)
              examples/index.json  manifesto de projetos (pasta PlatformIO + hardware-studio.json + firmware)
     │ leem / instanciam
 dados        src/parts/catalog.js  peças como DADO puro: pinos, placa, fw, pcb, settings, controls, events, limits
 modelos      src/parts/models.js       comportamento elétrico por tipo (entra no solver)
              src/emulator/devices.mjs  protocolo de cada chip periférico (I²C, SPI, um fio, pinos)
              src/pcb/footprints.mjs    geometria dos footprints
              src/editor/parts-art.js   aparência (pixel art); sem arte própria, a peça usa a genérica
 motores      src/emulator/avr.mjs  CPU AVR + periféricos (ATmega328P, ATmega2560)
              src/editor/circuit.js solver nodal de corrente contínua
              src/pcb/pcb.mjs       netlist, posicionamento, roteamento, DRC · src/pcb/gerber.mjs fabricação
```

**Regras de dependência**
1. Motores não conhecem peças. `avr.mjs` não sabe o que é um OLED, `circuit.js` não sabe o que é um LED, `pcb.mjs` recebe o catálogo por parâmetro.
2. O catálogo é só dado (o teste exige que ele sobreviva a `JSON.stringify`). Pode ir para um Worker, um arquivo ou um servidor.
3. Existe uma única ligação circuito → firmware (`bindCircuit`). Nenhuma página liga dispositivos à mão.
4. Projeto é pasta: `platformio.ini`, `src/`, `hardware-studio.json` (circuito) e o firmware compilado, listados no manifesto.
5. Firmware que conversa com o mundo (edge, IA, painel) fala JSON por linha na serial, como faria pelo BLE ou Wi-Fi.

## Contratos

**Peça** (`src/parts/catalog.js`)

| Campo | Para quê | Quem lê |
| --- | --- | --- |
| `type, name, category, tag, width, height, pins, description, kind` | identidade, desenho, pinos | editor, PCB |
| `board` | é placa/chip: `{ mcu, chip, pins, sda, scl, sck, mosi, ss, serial, analog, env, bare? }` | editor, rig, build |
| `fw` | como o firmware enxerga a peça: `i2c` (endereço, `addressSetting`), `pin` (`attach`, `pins`, `driven`), `spi` (`sck`, `mosi`, `attach`, `pins`, `optional`) | `core/bind.mjs` |
| `controls` | sliders de leitura do sensor `[chave, rótulo, unidade, min, max, passo, padrão]` | inspector → `device.setControl` |
| `events` | botões de evento `[método, rótulo, dica]` (ex.: queda no MPU6050) | inspector → método do dispositivo |
| `settings`, `readouts` | ajustes da peça (faixa, lista, texto, cor, caixa) e leituras | inspector, validação de importação |
| `limits` | limites que viram aviso (ex.: `icMax` do transistor) | modelo elétrico |
| `pcb` | `{ fp, ref, value, lcsc, merge }`, `{ header }`, `{ net }` ou `{ refuse }` | `pcb/footprints.mjs` |

**Dispositivo** (`src/emulator/devices.mjs`): I²C implementa `address`, `start(read) → ack`, `write(byte) → ack`, `read() → byte`, `stop()`; de pino implementa `attach(mcu, pin)` e `onDrive({ output, level })`; SPI se encadeia em `mcu.spiDevice`. Opcionais: `setControl(chave, valor)`, métodos de evento. O tempo é sempre o do chip (`this.mcu.time`), nunca o relógio da parede.

**Modelo elétrico** (`src/parts/models.js`): `stamp` (entra no solver), `settle` (estado discreto), `conducts`, `rails`, `clear`, `diode`, `observe`, e as marcas `pwm`, `timeDependent` e `clicks`. É achado pelo tipo, pelo `kind` ou pelo `board`.

**Chip** (`src/emulator/avr.mjs`): `createMcu(hex, board.mcu)` devolve um objeto com `run(ciclos)`, `runSeconds`, `time`, `onSerial`, `serialInput`, `setInput`, `pinSnapshot`, `pulseInfo`, `analog[]`, `attachI2C`, `attachPinDevice`, `spiDevice` e `eeprom`. Outra arquitetura (ESP32, RP2040, ARM) entra implementando essa mesma interface e um novo valor de `board.mcu`; o resto da plataforma não muda.

**Projeto** (`examples/index.json`): `{ id, title, category, description, icon, circuit, firmware, source, ready, pcb? }`. A linha `ready` é o que o firmware imprime ao dar boot.

## Receitas

| Quero… | Faço | Ganho sem mais nada |
| --- | --- | --- |
| peça com protocolo que já existe | uma entrada no catálogo (+ arte, se quiser) | biblioteca, inspector, firmware, netlist, footprint (conector), testes de contrato |
| sensor com protocolo novo | uma classe em `devices.mjs` + a entrada | o mesmo; exemplo: TMP117 (`tests/parts.mjs`) |
| comportamento elétrico novo | um modelo em `models.js` | solver, avisos, estado visual |
| footprint novo | `FOOTPRINTS` + `pcb.fp` na peça | PCB, Gerber, BOM, posição |
| projeto novo | pasta PlatformIO + entrada no manifesto | Exemplos do editor, VS Code, teste de boot e de PCB (`tests/projects.mjs`) |
| página ou ferramenta nova | `createRig({ hex, circuit, catalog })` | chip com todas as peças ligadas como no editor |
| outro chip/arquitetura | implementar a interface de chip acima | editor, rig, vitrines e testes passam a aceitá-lo |

## Testes que guardam cada contrato

| Teste | Garante |
| --- | --- |
| `tests/parts.mjs` | cada peça é dado puro e coerente (pinos, arte, `fw`, `pcb`, ajustes); prova de extensão com o TMP117 |
| `tests/projects.mjs` | cada projeto do manifesto sobe pelo rig, liga todas as peças, dá boot e vira placa sem violações |
| `tests/browser.mjs` | os modelos elétricos no editor real (LED, botão, NPN, relé, RGB, 7 segmentos, RC, AND, potenciômetro, buzzer, diodo) e o inspector gerado pelo catálogo |
| `tests/avr.mjs` | a CPU e os periféricos com firmwares reais, no Uno e no Mega |
| `tests/pcb.mjs` | netlist, roteamento, DRC que acha defeitos, Gerber/Excellon/zip |
| `tests/build.mjs`, `vscode/` `npm test` | compilação de pastas e extensão |
| `tools/a11y-audit.cjs` | zero violações de acessibilidade em todas as páginas |

## Onde ainda há código por tipo

No `src/app.js` sobram 14 desvios por tipo de peça, de 54 que havia: as saídas visuais durante o firmware (texto do LCD, ângulo do servo, cadeia de NeoPixels, telas OLED/TFT, som do buzzer), a checagem de cristal e desacoplamento do chip nu e o botão momentâneo. Funcionam e estão cobertos pelos testes de navegador e de projeto.
