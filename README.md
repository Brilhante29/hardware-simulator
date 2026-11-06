# Hardware Simulator

Um simulador de circuitos leve, local e extensível. A ideia é combinar a simplicidade de montar e testar um circuito no navegador com uma biblioteca que cada pessoa possa ampliar.

## Abrir

O aplicativo não precisa de instalação, backend nem conta. Abra `index.html` em um navegador moderno ou sirva a pasta com qualquer servidor estático. Os projetos ficam no `localStorage` do navegador; use **Exportar** para guardar ou compartilhar um arquivo JSON.

## O que já funciona

- Editor visual com seleção, movimentação, zoom, enquadramento e conexão de terminais.
- Biblioteca local com Arduino Uno, LED, resistor, botão, fonte DC, buzzer, potenciômetro, display e porta AND.
- Criação de componentes personalizados com pinos nomeados, disponíveis no navegador atual.
- Simulação básica de circuito: continuidade por fios, resistores e chaves; LEDs e buzzer reagem às fontes e às saídas digitais.
- Intérprete inicial de sketch para sequências `digitalWrite(pin, HIGH/LOW)` e `delay(ms)`.
- Exemplos, desfazer/refazer, propriedades, salvamento automático, importação e exportação JSON.
- Interface responsiva e sem dependências externas para a lógica do simulador.

## Limites atuais

Esta é a primeira fatia funcional, não uma emulação completa de hardware. O código não é compilado como C++ real. O simulador ainda não modela tensão/corrente analógica, sensores físicos, protocolos I²C/SPI, Wi-Fi, múltiplas placas, depuração ou todos os componentes comerciais. Componentes personalizados nesta versão são peças visuais com pinos; seu comportamento elétrico ainda não pode ser programado pela interface.

## Próximas etapas recomendadas

1. Definir contratos para pinos, estados, eventos e modelos de comportamento das peças.
2. Adicionar componentes digitais e sensores por módulos independentes, com exemplos verificáveis.
3. Integrar emulação real de microcontrolador e compilação de firmware como uma camada opcional.
4. Acrescentar importação/exportação documentada, biblioteca comunitária e testes de compatibilidade.
5. Evoluir para simulação analógica SPICE sem deixar o editor pesado para projetos simples.

## Estrutura

```text
index.html       Interface e pontos de montagem
src/app.js       Catálogo, editor, projetos e motor inicial de simulação
src/style.css    Tema e layout responsivo
```

## Licença

MIT. Consulte [LICENSE](LICENSE).
