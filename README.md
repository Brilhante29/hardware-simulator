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
- `boot.html`: dá boot no `firmware.hex` do PlatformIO num Arduino Uno emulado.

## Tour em vídeo

[docs/media/hardware-studio-tour.mp4](docs/media/hardware-studio-tour.mp4) (1min48, 1080p, com trilha chiptune original) mostra as animações da oficina, a bancada, o editor com três projetos que combinam placas, o registrador e os testes. O roteiro em [tools/demo-video](tools/demo-video/README.md) regrava o vídeo.

## Boot de firmware (Arduino Uno)

Igual ao fluxo que você já usa com PlatformIO: **o PlatformIO compila, o Hardware Studio dá boot**. O emulador do ATmega328P (`src/emulator/avr.mjs`) foi escrito para este projeto, executa cada instrução do `firmware.hex` e emula Timer0/1/2, GPIO, PWM, USART (TX e RX) e ADC.

```sh
# no platformio.ini do seu projeto
extra_scripts = post:/caminho/para/hardware-simulator/tools/platformio/simulate.py

pio run -t simulate                          # compila e roda em tempo real; digite para mandar pela serial
SIM_ARGS="--seconds 5 --pins" pio run -t simulate   # roda 5 s e mostra cada mudança de pino
node tools/avr-run.mjs .pio/build/uno/firmware.hex  # sem PlatformIO
```

No navegador, abra `boot.html`, solte o `.pio/build/uno/firmware.hex` e use **Vigiar arquivo** (Chrome/Edge): a cada `pio run` o chip reinicia sozinho com o firmware novo. Há monitor serial, botões nos pinos de entrada e um potenciômetro no A0.

Ainda não emula: EEPROM, SPI, I²C, watchdog, sleep real, outras placas (ESP32) e o consumo elétrico do chip. `node tests/avr.mjs` roda 9 testes com firmwares reais compilados pelo PlatformIO (`tests/fixtures/avr`).

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
