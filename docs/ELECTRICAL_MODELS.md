# Modelos elétricos — versão 0.2

## Fontes e parâmetros

| Modelo | Documento oficial | Valores utilizados |
| --- | --- | --- |
| Resistor SFR25 | [Vishay 28722](https://www.vishay.com/docs/28722/sfr25.pdf), 11-Feb-2025, pp. 1/3 | 0,4 W até 70 °C; redução linear até zero a 155 °C; estimativa térmica com 200 K/W |
| LED WP7113ID | [Kingbright](https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf), V.14A, p. 2 | Vf típico 1,9 V em 10 mA/25 °C; máximos 30 mA, 75 mW, reverso 5 V; Tj 125 °C; 560 K/W sob condições de montagem do documento |
| Capacitor eletrolítico paramétrico | [Nichicon CAT.8101H](https://www.nichicon.co.jp/english/wp-content/uploads/CAT.8101.pdf), §§2-2/2-3 | Mecanismos qualitativos de sobretensão: aumento de fuga, calor, gás, ruptura dielétrica e alívio de pressão |

100 µF e 16 V são parâmetros do experimento, **não a identificação de um SKU ensaiado**. O modelo não inclui tolerância, ESR, fuga, envelhecimento ou pressão. As notas de aplicação sustentam mecanismos possíveis, não calibram a política didática.

## Equações e hipóteses

Sem limitação de corrente, `Vc(t+dt) = Vs + (Vc(t) − Vs) × exp(−dt/(RC))`. Durante limitação, `dVc/dt = ±Ilim/C`; a transição para o trecho exponencial é analítica. O modelo de fonte é ideal e bidirecional: pode absorver corrente na descarga, o que uma fonte física comum pode não fazer.

`E = CV²/2`; `Pr = I²R`. LED direto usa `I = clamp((Vs − 1,9)/R, 0, Ilim)`. Não há curva I–V completa, avalanche, corrente reversa nem capacitância do LED. As temperaturas `Ta + P × Rtheta` são aproximações estacionárias; não modelam aquecimento transiente nem estabelecem dano.

O aviso de R1 compara potência instantânea à referência **contínua**. A avaliação de sobrevivência a pulsos, tensão máxima, montagem e demais condições do componente exige modelos adicionais. A indicação de temperatura fora de faixa não valida a extrapolação física.

## Ruptura e correlação

No cenário destrutivo, uma política explícita injeta falha quando a tensão calculada do capacitor ultrapassa a nominal e a fonte está configurada para pelo menos 100× essa nominal. **Não é uma lei de ruptura**, e atravessar 16 V não implica que um capacitor de 16 V necessariamente explodirá naquele instante. O tempo mostrado pertence à simulação; o tempo da animação é desacelerado para visualização.

- **Aberto:** corrente zero, potência de R1 zero, tensão da fonte nos terminais abertos. A tela rotula esses terminais; não trata 1.600 V como carga armazenada em um capacitor intacto.
- **Curto:** tensão terminal zero; corrente definida por R1 e pela fonte. Em 1.600 V / 1 kΩ com limite de 200 mA, a saída da fonte cai a 200 V e R1 dissipa 40 W.
- A energia imediatamente anterior à injeção fica registrada. A distribuição dessa energia após a ruptura não é resolvida. Não são previstas pressão, gases, arco, fogo nem trajetória de fragmentos.
- Uma falha persiste até reiniciar/substituir o componente. Simplesmente reduzir a tensão não repara o estado.

A oficina inicial demonstra a falha aberta; a bancada oferece também curto. LEDs e resistores geram alertas de estresse, sem uma lei automática de queima inventada.

## Validação reproduzível

`node tests/all.mjs`: **24/24 grupos aprovados em 2026-11-06**. 16 grupos elétricos verificam soluções analíticas e invariantes; 8 grupos digitais verificam comportamento funcional do SN74HC595. Os limites documentais são referências, não ensaios de laboratório. A bancada permite repetir e exportar os resultados.

Verificação de interface: entrada 100× → aberto / 0 mA / 0 mW; restauração; troca real entre SVG de LED/capacitor; acesso direto por cenário; leitura e navegação em largura de 375 px. Exportações Arduino/PlatformIO não foram compiladas.
