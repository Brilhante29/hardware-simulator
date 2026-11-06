# Hardware Studio

Uma oficina aberta para experimentar hardware no navegador. A entrada em **pixel art animada** já contém um circuito RC interativo: fonte, resistor e capacitor compartilham o mesmo modelo elétrico da bancada.

## Executar

Não há etapa de build nem dependências de runtime. Sirva a pasta por HTTP (módulos ES não devem ser abertos por `file://`):

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080`. O aplicativo não exige conta, não envia projetos a um backend e não carrega fontes de terceiros. A hospedagem de uma prévia pode exigir autenticação do provedor.

- `index.html`: oficina animada, cenários 12 V, 32 V e 100×.
- `studio.html`: bancada de medição, cenários editáveis, biblioteca e validação.
- `editor.html`: editor livre original, fios, peças e importação Wokwi.
- `lab/sn74hc595.html`: registrador digital interativo.

## Tour em vídeo

[docs/media/hardware-studio-apresentacao.mp4](docs/media/hardware-studio-apresentacao.mp4) (6,5 min, 1080p) percorre a oficina, a bancada, a biblioteca, o editor, três projetos que combinam placas e a validação. O roteiro em [tools/demo-video](tools/demo-video/README.md) regrava o vídeo.

## Aparência

Use **Claro** ou **Escuro** para mudar a oficina e as telas de simulação. A escolha inicial acompanha o sistema. O ajuste **Cores** é independente do tema:

1. Desativado: clique duas vezes em **Cores**, sem precisar de um duplo clique rápido. O segundo clique abre o popup.
2. Confirme **Usar cores acessíveis** para aplicar azul/dourado, contraste e pistas por símbolos/padrões nos dois temas.
3. Ativado: um clique abre o popup. Desmarque a opção e confirme para desligar. Cancelar ou Escape mantém a preferência anterior.

A oficina também tem uma pista óptica clicável experimental. Ela não é uma placa de Ishihara calibrada, não identifica daltonismo e não garante que apenas pessoas daltônicas a enxerguem. O acesso equivalente por botão e teclado permanece disponível. Não é necessário declarar nenhuma condição. Só a preferência de aparência é salva localmente.

O tema escuro traz lua, estrelas e iluminação noturna; o claro traz sol e uma paleta azul/lilás. Clique no robô para ele acenar. As animações respeitam a pausa e movimento reduzido.

## O que funciona

| Recurso | Escopo atual |
| --- | --- |
| Capacitor | Carga RC analítica com limitação de corrente; energia; falha aberta/curto injetável |
| Resistor | Potência I²R e referência contínua SFR25 com redução por temperatura ambiente |
| LED | Aproximação DC com Vf fixo, alertas de corrente, potência, tensão reversa e temperatura estimada |
| SN74HC595 | Modelo lógico, estados X/Z, clocks, latch, clear e OE; todos os 256 bytes testados |
| Biblioteca | 114 referências oficiais de placas, SoCs, MCUs e periféricos; cada item mostra o estado do modelo |
| Editor livre | Montagem, conexão, componentes simples personalizados, JSON e importação de `diagram.json` |
| Arduino / PlatformIO | Exportação de exemplo `.ino` ou projeto ZIP; sem compilação, upload ou plugin de IDE ainda |

**114 referências não são 114 dispositivos emulados.** O catálogo amplia a pesquisa, enquanto os modelos funcionais são os explicitados acima. O editor livre continua com seu motor inicial de continuidade e interpretação limitada de `digitalWrite`/`delay`; ele não usa automaticamente o novo motor analógico.

## Falhas e precisão

O botão **100×** configura uma fonte de 1.600 V para um capacitor paramétrico de 16 V. O cenário injeta uma falha ao cruzar a tensão nominal; a animação indica essa hipótese. Ela **não calcula pressão, arco, fragmentos, tempo real de ruptura ou probabilidade de explosão**. Na falha aberta, I e P em R1 caem a zero. Na falha em curto, o circuito é recalculado com a limitação de corrente da fonte. Os limites de datasheet indicam estresse, não um instante garantido de destruição.

Veja [modelos elétricos e evidências](docs/ELECTRICAL_MODELS.md) e [primeira validação digital](docs/FIRST_VALIDATION.md).

## Testar

```sh
node tests/all.mjs
node tests/display-contrast.mjs
```

24 grupos: 8 digitais + 16 elétricos. Incluem os 256 valores do registrador, solução RC fechada, partição de passos, balanço de potência em 500 configurações e consequências das falhas. Também podem ser executados em **Bancada → Validação** e exportados como JSON. Não são ensaios destrutivos de hardware físico.

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
