# Hardware Studio

Uma oficina aberta para experimentar hardware no navegador. A entrada em **pixel art animada** já contém um circuito RC interativo: fonte, resistor e capacitor compartilham o mesmo modelo elétrico da bancada.

## Executar

Não há etapa de build nem dependências de runtime. Sirva a pasta por HTTP (módulos ES não devem ser abertos por `file://`):

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080`. O aplicativo não exige conta, não envia projetos a um backend e não carrega fontes de terceiros. A hospedagem de uma prévia pode exigir autenticação do provedor.

- `index.html`: oficina animada; 12 V, 32 V e 100× com desfecho calculado e relógio real.
- `studio.html`: bancada de medição, cenários editáveis, biblioteca e validação.
- `editor.html`: editor livre com peças em pixel art, fios, sketch Arduino simplificado e projetos JSON.
- `lab/sn74hc595.html`: registrador digital interativo.
- `boot.html`: dá boot no `firmware.hex` do PlatformIO num Arduino Uno ou Mega 2560 emulado (o chip é detectado pelo arquivo).

## Tour em vídeo

[docs/media/hardware-studio-tour.mp4](docs/media/hardware-studio-tour.mp4) (1min48, 1080p, com trilha chiptune original) mostra as animações da oficina, a bancada, o editor com três projetos que combinam placas, o registrador e os testes. O roteiro em [tools/demo-video](tools/demo-video/README.md) regrava o vídeo.

## Boot de firmware (Arduino Uno e Mega 2560)

Igual ao fluxo que você já usa com PlatformIO: **o PlatformIO compila, o Hardware Studio dá boot**. O emulador AVR (`src/emulator/avr.mjs`) foi escrito para este projeto e executa cada instrução do `firmware.hex` num ATmega328P (`board = uno`) ou ATmega2560 (`board = megaatmega2560`). O chip sai da tabela de vetores do arquivo (26 vetores no Uno, 57 no Mega); `--mcu` força um deles.

| Periférico | Funciona com |
| --- | --- |
| GPIO, pull-up, `digitalRead/Write` | botões, LEDs, qualquer pino D0–D13 e A0–A5 |
| Timer0/1/2, PWM | `millis`, `delay`, `analogWrite`, `Servo`, `tone` |
| USART0 TX/RX | `Serial.print`, `Serial.read` (ritmo real do baud) |
| ADC 10 bits | `analogRead` (potenciômetro) |
| INT0/INT1, PCINT | `attachInterrupt`, ISRs de troca de pino |
| EEPROM 1 KB | `EEPROM.get/put/update` (guardada entre resets e no navegador) |
| Watchdog e sleep | `wdt_enable`, reset por watchdog, `sleep_cpu` (idle e power-down) |
| SPI mestre | `SPI.transfer` com dispositivo plugável |
| I²C (TWI) mestre e escravo | `Wire`, `LiquidCrystal_I2C` (LCD 0x27), `Adafruit_SSD1306` (OLED 0x3C), BME280, MPU6050, DS3231 (RTClib), BH1750; dois Unos com `Wire.onReceive/onRequest` |
| SPI mestre e escravo; USART em SPI (MSPIM) | `SPI.transfer`, dois Unos com SS no D10 |
| Um fio e pulsos | DHT11/DHT22 (Adafruit DHT), NeoPixel WS2812 (Adafruit NeoPixel) |
| Comparador, captura do Timer1, referências do ADC | `ACSR`/AIN0/AIN1, `ICR1` no D8, `analogReference(INTERNAL)` |
| Consumo | estimativa pelo datasheet: ~10,4 mA ativo, ~2,4 mA idle, µA em power-down (Mega: ~20 mA ativo) |

No **Mega 2560** vale tudo acima e mais: 256 KB de flash (PC de 17 bits, `ELPM`/`pgm_read_byte_far`, `EICALL`), 8 KB de RAM, 4 KB de EEPROM, portas A–L (D0–D53, A0–A15), Timers 3/4/5 com canal C (15 pinos PWM), `Serial1`–`Serial3`, INT0–INT7, PCINT nas portas B/E/J/K, ADC8–ADC15 e a referência de 2,56 V. I²C fica no D20/D21 e SPI no D50–D53, como na placa. Firmware de um chip carregado no outro é recusado com o motivo, como faz o `avrdude`.

```sh
# no platformio.ini do seu projeto
extra_scripts = post:/caminho/para/hardware-simulator/tools/platformio/simulate.py

pio run -t simulate                                       # compila e roda em tempo real
SIM_ARGS="--seconds 5 --pins --lcd --oled" pio run -t simulate
node tools/avr-run.mjs .pio/build/uno/firmware.hex --lcd --eeprom eeprom.bin
node tools/avr-run.mjs .pio/build/megaatmega2560/firmware.hex   # Serial1–3 aparecem como [Serial1] …
```

O `simulate.py` passa o `build.mcu` da placa do `platformio.ini` para o emulador.

- **Navegador (`boot.html`):** solte o `firmware.hex`, use **Vigiar arquivo** (Chrome/Edge) e cada `pio run` reinicia o chip. Monitor serial, botões nos pinos, potenciômetro em qualquer entrada analógica, envio para Serial…Serial3 no Mega, LCD, OLED, pulsos medidos (servo em graus, frequência do `tone`) e som do `tone()`.
- **Editor (`editor.html`):** selecione o Uno ou o Mega 2560 → **Carregar .hex** (ou **Vigiar**). O firmware real move o circuito: LEDs (com brilho de PWM), buzzer com som, botões e chaves viram entradas, potenciômetro vira tensão no pino analógico, servo gira, LCD e OLED ligados no I²C da placa (A4/A5 no Uno, D20/D21 no Mega) mostram a tela. Exemplo pronto: importe `examples/firmware/painel-projeto.json` (fonte em `examples/firmware/painel`).

No editor, placas se falam por serial (TX→RX; no Mega também TX1/RX1 D18/D19, TX2/RX2 D16/D17, TX3/RX3 D14/D15), I²C (SDA/SCL em comum) ou SPI (SCK/MOSI e SS); os chips ligados rodam em passo de 10 µs. Fica de fora outra arquitetura de CPU (ESP32/ESP-IDF, Xtensa/RISC-V): é outro emulador inteiro. `node tests/avr.mjs` roda os testes com firmwares reais compilados pelo PlatformIO (`tests/fixtures/avr`).

## Aparência

Use **Claro** ou **Escuro** para mudar a oficina e as telas de simulação. A escolha inicial acompanha o sistema. O ajuste **Cores** é independente do tema:

1. Desativado: clique duas vezes em **Cores**, sem precisar de um duplo clique rápido. O segundo clique abre o popup.
2. Confirme **Usar cores acessíveis** para aplicar azul/dourado, contraste e pistas por símbolos/padrões nos dois temas.
3. Ativado: um clique abre o popup. Desmarque a opção e confirme para desligar. Cancelar ou Escape mantém a preferência anterior.

A oficina também tem uma pista óptica clicável experimental. Ela não é uma placa de Ishihara calibrada, não identifica daltonismo e não garante que apenas pessoas daltônicas a enxerguem. O acesso equivalente por botão e teclado permanece disponível. Não é necessário declarar nenhuma condição. Só a preferência de aparência é salva localmente.

O tema escuro traz lua, estrelas e iluminação noturna; o claro traz sol e uma paleta azul/lilás. Clique no robô para ele acenar.

A entrada é animada: o título sobe palavra por palavra, a bancada liga como um monitor CRT e cada clique solta pixels. A barra **Descobertas** marca cinco achados (carga, sobretensão, ruptura, troca de peça e o robô) e celebra quando completa. Os cartuchos inclinam com o mouse e “encaixam” ao abrir. Nada disso é salvo, e tudo desliga com **Pausar movimento** ou com movimento reduzido do sistema.

Textos complementares ficam em abinhas (ⓘ) que abrem e recolhem; os limites dos modelos continuam lá dentro.

## O que funciona

| Recurso | Escopo atual |
| --- | --- |
| Capacitor | Carga com fonte CV/CC, fuga real acima da nominal, aquecimento, H₂, pressão e válvula; falha manual opcional |
| Resistor | SFR25 com aquecimento (200 K/W), escurecimento, fumaça e abertura |
| LED | Diodo de Shockley ajustado ao datasheet, junção aquecendo, perda de brilho, avalanche reversa e queima |
| SN74HC595 | Modelo lógico, estados X/Z, clocks, latch, clear e OE; todos os 256 bytes testados |
| Biblioteca | 114 referências oficiais de placas, SoCs, MCUs e periféricos; cada item mostra o estado do modelo |
| Editor livre | Montagem, fios, peças personalizadas, projetos JSON, gavetas no celular; cada peça diz se é simulada ou só visual |
| Sketch no editor | `setup()` uma vez e `loop()` repetido, constantes, `#define`, `LED_BUILTIN`, `for`, `if`, `digitalWrite`, `delay`; o resto vira aviso |
| Arduino / PlatformIO | Exportação de exemplo `.ino` ou projeto ZIP; sem compilação, upload ou plugin de IDE ainda |

**114 referências não são 114 dispositivos emulados.** O catálogo amplia a pesquisa, enquanto os modelos funcionais são os explicitados acima. No editor, LEDs, buzzer, chaves, resistores, fontes e o Uno participam da simulação lógica de continuidade; sensores, motores, displays e demais peças são só visuais e o inspetor avisa. O editor não compila C++ e não usa o motor analógico da bancada.

## O que acontece de verdade

A bancada e a oficina usam o mesmo motor eletrotérmico (`src/engine/physics.mjs`). O desfecho sai da física, não de um gatilho:

| Cenário | Desfecho calculado | Base |
| --- | --- | --- |
| 12 V em C1 de 16 V | Carrega; nada esquenta | Fuga 0,01·C·V (16 µA) |
| 32 V (2×) via 1 kΩ | C1 trava em ~21,6 V como um zener, esquenta, gera H₂ e abre a válvula em **minutos** | CDE: "modo tensão constante… o hidrogênio gera pressão e falha" |
| 1.600 V (100×) via 1 kΩ, fonte de 200 mA | **R1 queima primeiro** (40 W num resistor de 0,4 W): escurece em ~1 s, fumaça em ~1,5 s, abre em ~3 s. C1 só esquenta | Vishay SFR25: 0,4 W, 200 K/W, 155 °C |
| 30 V / 3 A direto | Válvula abre em ~1 s, sem estilhaços | Nichicon: válvula ensaiada sem chamas nem fragmentos |
| Válvula obstruída | Só aqui a lata estoura | Nichicon: função da válvula |
| Capacitor invertido a 1 A | Conduz e ventila em segundos | Nichicon: ensaio reverso de 1 A |
| LED sem resistor (5 V) | ~280 mA, junção passa de 125 °C e o chip abre em ~2 s | Kingbright: IF 30 mA, RthJA 560 °C/W |

Números que nenhum datasheet traz (capacidade térmica, volume livre da lata, pressão de abertura da válvula, temperaturas em que a laca fuma) são **premissas declaradas** e aparecem em **Ver fontes**. Os tempos são estimativas da ordem de grandeza, não certificação. A falha manual (aberto/curto) continua disponível para estudo.

Veja [modelos elétricos e evidências](docs/ELECTRICAL_MODELS.md) e [primeira validação digital](docs/FIRST_VALIDATION.md).

## Testar

```sh
node tests/all.mjs
node tests/avr.mjs
node tests/editor.mjs
node tests/display-contrast.mjs
```

24 grupos: 8 digitais + 16 elétricos. Incluem os 256 valores do registrador, solução RC fechada, partição de passos, balanço de potência em 500 configurações e consequências das falhas. `tests/editor.mjs` cobre o interpretador de sketch do editor (13 casos, incluindo que expressões não executam código arbitrário). Os 24 grupos também podem ser executados em **Bancada → Validação** e exportados como JSON. Não são ensaios destrutivos de hardware físico.

A verificação de aparência testa 80 pares de tokens reais de texto/fundo nas quatro paletas contra 4,5:1. Ela não equivale a uma auditoria completa de acessibilidade nem a validação clínica da pista óptica.

## Desempenho e acessibilidade

- Canvas original de 560 × 365, sem motor 3D, vídeo ou framework.
- Oficina limitada a 24 desenhos/s e leituras a aproximadamente 6 Hz; pausa fora da área visível e ao ocultar a página.
- Bancada: passo simulado de 5 ms, pintura até 30 Hz e histórico limitado a 360 pontos.
- Movimento reduzido respeitado; botão para pausar todas as animações da entrada.
- Controles nativos, foco visível, informações de tensão/corrente fora do canvas.
- Fontes servidas localmente. Pixelify Sans está sob SIL OFL; código e arte procedural do projeto sob MIT.

## Contribuir e próximos modelos

Veja [CONTRIBUTING.md](CONTRIBUTING.md), [problemas e decisões](docs/RESEARCH_AND_DESIGN.md), [catálogo](docs/HARDWARE_CATALOG.md), [arquitetura](docs/SIMULATOR_ARCHITECTURE.md) e [adaptadores de IDE](docs/TOOLCHAIN_ADAPTERS.md).

PCB, SPICE, emulação completa de MCU/SoC, protocolos e wearable completo permanecem no plano. Os arquivos de arquitetura e adaptadores descrevem direção; não prometem suporte executável hoje.

## Licença

[MIT](LICENSE). Fonte: [Pixelify Sans / SIL OFL](assets/fonts/OFL.txt). Referências de fabricantes mantêm seus direitos; links não representam redistribuição dos datasheets.
