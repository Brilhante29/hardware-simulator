# Hardware Simulator

Um simulador de circuitos leve, local e extensível. A ideia é combinar a simplicidade de montar e testar um circuito no navegador com uma biblioteca que cada pessoa possa ampliar.

## Abrir

O aplicativo não precisa de instalação, backend nem conta. Abra `index.html` em um navegador moderno ou sirva a pasta com qualquer servidor estático. Os projetos ficam no `localStorage` do navegador; use **Exportar** para guardar ou compartilhar um arquivo JSON.

## O que já funciona

- Editor visual com seleção, movimentação, zoom, enquadramento e conexão de terminais.
- Catálogo local com mais de 20 peças: Arduino Uno, passivos, chaves, sensores, saídas, displays e lógica.
- Criação de componentes personalizados com pinos nomeados e comportamento visual, condutor, chave ou fonte DC; os componentes personalizados viajam junto no JSON exportado.
- Simulação básica de circuito: continuidade por fios, resistores e chaves; LEDs e buzzer reagem às fontes e às saídas digitais.
- Intérprete inicial de sketch para sequências `digitalWrite(pin, HIGH/LOW)` e `delay(ms)`.
- Importação de `diagram.json` do Wokwi: componentes reconhecidos viram peças do catálogo e peças ainda não reconhecidas são preservadas como componentes personalizados; fios reconhecidos mantêm suas cores.
- Exemplos, desfazer/refazer, propriedades, salvamento automático, importação e exportação JSON.
- Interface responsiva e sem dependências externas para a lógica do simulador.

## Limites atuais

Esta é a primeira fatia funcional, não uma emulação completa de hardware. O código não é compilado como C++ real. O simulador ainda não modela tensão/corrente analógica, sensores físicos, protocolos I²C/SPI, Wi-Fi, múltiplas placas, depuração ou todos os componentes comerciais. Algumas peças do catálogo, como displays, sensores e lógica, já podem ser colocadas e conectadas visualmente, mas ainda não têm modelos elétricos próprios. Componentes personalizados aceitam comportamento simples de condutor, chave ou fonte; não há editor para escrever novos modelos de firmware. Na importação do Wokwi, o `diagram.json` traz a montagem, mas o código costuma estar em um arquivo separado e precisa ser colado no editor.

## Próximas etapas recomendadas

1. Definir contratos para pinos, estados, eventos e modelos de comportamento das peças.
2. Adicionar componentes digitais e sensores por módulos independentes, com exemplos verificáveis.
3. Integrar emulação real de microcontrolador e compilação de firmware como uma camada opcional.
4. Acrescentar importação/exportação documentada, biblioteca comunitária e testes de compatibilidade.
5. Evoluir para simulação analógica SPICE sem deixar o editor pesado para projetos simples.

## Catálogo oficial de hardware

Índice inicial com 54 placas, SoCs e periféricos, mais plano de simulação do wearable: [catálogo JSON](data/hardware-catalog.json) · [guia do catálogo e wearable](docs/HARDWARE_CATALOG.md). O catálogo é uma base de fontes oficiais; nem todo item possui modelo funcional ainda.

## Experimentos de hardware ponta a ponta

O projeto está sendo estruturado para comparar variantes de SoC/MCU, periféricos, firmware e PCB no mesmo experimento. Veja o [plano de arquitetura](docs/SIMULATOR_ARCHITECTURE.md) e o [template de variantes wearable](examples/wearable-platform-matrix.json). Estes arquivos definem direção e formato inicial; editor PCB, compilação e emulação de MCU ainda não estão implementados.

## Estrutura

```text
index.html       Interface e pontos de montagem
src/app.js       Catálogo, editor, projetos e motor inicial de simulação
src/style.css    Tema e layout responsivo
```

## Licença

MIT. Consulte [LICENSE](LICENSE).
