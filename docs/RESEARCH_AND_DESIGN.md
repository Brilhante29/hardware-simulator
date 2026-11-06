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

A arte do Hardware Studio foi desenhada em código para o projeto; não reutiliza sprites dessas referências. Paleta de papel, verde e terracota; títulos Pixelify; texto corrido e números legíveis; controles de experimento dentro da oficina; cartões como cartuchos. O movimento explica estado ou dá vida ao ambiente. Pode ser pausado; não há efeitos de tela inteira nem áudio automático.

## Próximas etapas técnicas

1. Integrar os modelos verificados ao editor de rede e definir validação de pinagem/netlist.
2. Adicionar fixtures com condições, tolerâncias, curvas e origem de cada parâmetro.
3. Conectar emuladores/compiladores sob adaptadores versionados, começando por uma MCU.
4. Integrar análise SPICE com solução fora da thread da interface e resultados rastreáveis.
5. Evoluir o exemplo wearable por subsistemas, sem prometer inferência médica ou hardware completo antes da validação.
