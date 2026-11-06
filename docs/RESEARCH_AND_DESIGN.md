# Pesquisa e decisões de produto

Pesquisa em 2026-11-06, com foco em fontes oficiais. O objetivo é uma oficina acessível que mostre seus limites de fidelidade.

| Problema | Evidência | Resposta no projeto |
| --- | --- | --- |
| Montagem digital não equivale a um simulador analógico geral | [Wokwi Analog API](https://docs.wokwi.com/chips-api/analog) e [resistor](https://docs.wokwi.com/parts/wokwi-resistor) explicitam limites de suporte analógico | Modelos analógicos separados da renderização; RC analítico na primeira fatia; SPICE no plano |
| Peças novas precisam de comportamento, não só desenho | [Wokwi Custom Chips](https://docs.wokwi.com/chips-api/getting-started) já oferece extensão — não seria correto dizer que nenhuma plataforma permite isso | Distinguir referência, representação visual e modelo testado; documentar como adicionar fonte, módulo e teste |
| Modelo e pinagem incorretos tornam a simulação enganosa | [KiCad 9 / Eeschema](https://docs.kicad.org/9.0/en/eeschema/eeschema.html), seções de simulação e mapeamento de modelos | Contratos de pinos, fontes e hipóteses; expansão PCB prevista, não implementada |
| Ultrapassar um máximo não revela exatamente quando ou como ocorre dano | [Nichicon](https://www.nichicon.co.jp/english/wp-content/uploads/CAT.8101.pdf) descreve mecanismos; [TI SN74HC595](https://www.ti.com/lit/ds/symlink/sn74hc595.pdf) distingue limites absolutos e operação recomendada | Evento de falha explicitamente injetado; recálculo de consequências; visual sem falsa calibração de explosão |
| Catálogos grandes confundem disponibilidade com fidelidade | Contagem de itens não prova emulação | 114 referências identificadas como pendentes, com modelo lógico sinalizado quando disponível |

## Direção visual

O pedido do usuário é pixel art, movimento e uma identidade própria. Referências consultadas:

- [Vitrine de websites do ChatGPT](https://learn.chatgpt.com/showcase/websites): inclui propostas com linguagem de arcade e experiências além de cartões genéricos.
- [Sprig / Hack Club](https://sprig.hackclub.com/): criatividade em pixels conectada a hardware aberto.
- [Alita Lee](https://www.alitaee.dev/): mundo pixelado explorável como interface.
- [One Page Love / pixel art](https://onepagelove.com/style/pixel-art): composição e variedade de páginas nessa linguagem.

A arte do Hardware Studio foi desenhada em código para o projeto; não reutiliza sprites dessas referências. Títulos Pixelify; texto corrido e números legíveis; controles de experimento dentro da oficina; cartões como cartuchos. O movimento explica estado ou dá vida ao ambiente. Pode ser pausado; não há efeitos de tela inteira nem áudio automático.

### Temas e ambiente vivo

Referências adicionais consultadas na vitrine oficial:

- [Clockwork Observatory](https://developers.openai.com/showcase/impossible-kinetic-architecture): atribuição explícita a GPT-6 Astra; movimento mecânico, exploração e controles integrados ao ambiente.
- [Little Ritual](https://developers.openai.com/showcase/little-ritual): atribuição explícita a GPT-6 Astra; cena acolhedora, pequenas interações e atenção a dispositivos móveis.
- [MiniTown](https://developers.openai.com/showcase/minitown): cidade em miniatura e atmosfera que muda entre dia e noite. Usada como referência visual, sem atribuir um modelo específico por inferência.

Aplicação original: quatro paletas semânticas (claro, escuro e a variante acessível de cada), mudança de sol/lua, iluminação da bancada e um robô que acena ao toque. Canvas 2D existente, sem introduzir engine 3D ou biblioteca de animação. Os temas são compartilhados pelas quatro páginas e persistem localmente.

### Pista óptica e acesso ao ajuste

O pedido propõe um símbolo visível apenas para pessoas daltônicas. As [placas ocultas de Ishihara documentadas por Martin Krzywinski](https://mk.bcgsc.ca/ishihara-tests-for-colour-deficiency/plates.mhtml) mostram que alguns padrões podem ter visibilidade diferente em determinadas deficiências vermelho-verde. Isso **não sustenta uma regra universal** para qualquer tipo de daltonismo, pessoa, monitor ou iluminação.

A pista pixelada do projeto é original e experimental: não é uma placa clínica reproduzida nem foi validada com pessoas daltônicas. Não se afirma exclusividade de percepção. O símbolo tem nome acessível e oferece o mesmo fluxo do botão **Cores**. Não condicionamos o acesso a acertar um teste, enxergar a pista ou declarar uma condição.

Base normativa: [WCAG / uso de cor](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [contraste mínimo](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) e [tamanho de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Texto, símbolos, padrões de linha e bordas complementam as cores. A paleta azul/dourado é uma opção, não uma correção universal de percepção. As cores físicas de faixas de resistores e placas não são adulteradas por um filtro global.

Ativação exige dois cliques sequenciais, sem limite de tempo, e confirmação no diálogo. Quando ativa, um clique abre o diálogo; desmarcar e confirmar desativa nos dois temas. Cancelar, Escape ou fechar sem confirmar preservam a opção. São persistidos apenas `theme` e `accessible`, sem perfil de saúde, telemetria ou chamadas externas. O diálogo usa foco nativo, nome acessível e retorno ao acionador.

`tests/display-contrast.mjs` lê os tokens de CSS e verifica 80 combinações contra 4,5:1. Cobertura: texto principal, secundário, destaques, alertas e botões sobre fundos previstos. Não prova contraste de cada pixel da arte nem conformidade integral WCAG.

## Próximas etapas técnicas

1. Integrar os modelos verificados ao editor de rede e definir validação de pinagem/netlist.
2. Adicionar fixtures com condições, tolerâncias, curvas e origem de cada parâmetro.
3. Conectar emuladores/compiladores sob adaptadores versionados, começando por uma MCU.
4. Integrar análise SPICE com solução fora da thread da interface e resultados rastreáveis.
5. Evoluir o exemplo wearable por subsistemas, sem prometer inferência médica ou hardware completo antes da validação.
