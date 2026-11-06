# Primeira comparação funcional: SN74HC595

Fonte: Texas Instruments SCLS041J (outubro de 2021), seções 8.1 e 8.4, https://www.ti.com/lit/ds/symlink/sn74hc595.pdf, consultada em 2026-11-06.

Modelo digital ideal independente do editor principal, reutilizável no navegador e em Node. Atualização por evento, dois registradores de 8 bits e máscaras de bits conhecidos; sem timer contínuo ou dependências. Estado inicial dos dados é desconhecido. Não há simulação analógica, atrasos de propagação, setup/hold, consumo ou compilação de firmware. Mudanças simultâneas de dados/reset e clocks usam ordenação determinística do modelo e não validam comportamento físico sob violação de timing.

## Reproduzir
Execute `node tests/run.mjs`.
Para a bancada visual: sirva a raiz do repo com `python3 -m http.server 8000` e abra http://localhost:8000/lab/sn74hc595.html.
Envie 165; saídas continuam X até clicar Latch. Depois QA..QH = 1,0,1,0,0,1,0,1. Limpar shift não altera as saídas armazenadas até o próximo Latch. OE mostra Z sem apagar os dados.

## Resultado executado
8 grupos aprovados:
- Inicialização desconhecida e saída desabilitada.
- Todos os 256 bytes: ordem de bits e saída serial.
- Independência entre deslocamento e armazenamento.
- Clear assíncrono preservando armazenamento.
- OE desabilita sem destruir dados.
- Borda descendente/clock estável não desloca.
- Clocks comuns: armazenamento um ciclo atrás.
- Entrada inválida não altera parcialmente o estado.

Benchmark local: Node v24.22.1, 100 mil eventos de aquecimento e 1 milhão medidos em 78,56 ms (~12,7 milhões eventos/s). Medição única, sem navegador/UI, rede, analógico ou firmware; não é garantia de performance em outros computadores nem de frequência física do chip.
Os testes são vetores derivados da especificação funcional, não comparação com um chip físico nem certificação integral do datasheet.
