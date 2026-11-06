# Modelos elétricos e térmicos — versão 0.3

Um só motor (`src/engine/physics.mjs`) alimenta a oficina (`index.html`) e a bancada (`studio.html`).
Circuito: **fonte de bancada → R1 → C1 ou D1**, como numa bancada de verdade.

## Fontes

| Componente | Documento | O que usamos |
| --- | --- | --- |
| Fonte | Modelo de fonte de bancada CV/CC | Tensão constante até atingir o limite de corrente; depois corrente constante |
| R1 Vishay SFR25 | [Datasheet 28722, rev. 11-Feb-2025](https://www.vishay.com/docs/28722/sfr25.pdf) | P70 = 0,4 W; Rth = 200 K/W; filme até 155 °C; tensão-limite 250 V; sobrecarga curta 6,25 × Pn por 5 s (≤ 2 × 250 V) |
| C1 eletrolítico de alumínio | [Guia de aplicação CDE](https://www.cde.com/resources/technical-papers/KNO_CD_AEappGuide_R2.pdf) | Acima da tensão de surto a fuga fica "muito alta… como um zener"; o hidrogênio gera pressão e falha; formação ≥ 35 % acima da nominal; reverso > 1,5 V danifica |
| C1 eletrolítico de alumínio | [Nichicon CAT.8101H](https://www.nichicon.co.jp/english/products/pdf/aluminum.pdf) §2-3 | Fuga sobe rápido acima da nominal; o calor derruba a isolação do anodo; a válvula libera eletrólito vaporizado e H₂ (não é combustão) e é ensaiada para abrir **sem chamas nem fragmentos**; quanto maior a tensão, maior a chance de curto entre folhas; ensaio reverso a 1 A |
| D1 Kingbright WP7113ID | [Datasheet V.14A](https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf) | VF 1,9 V típ./2,3 V máx. a 10 mA; IF 30 mA; IFP 160 mA; PD 75 mW; VR 5 V; Tj 125 °C; RthJA 560 °C/W; −1,9 mV/°C |

## Equações

- **Fonte:** `I = clamp((Vs − Vcarga)/R, −Ilim, +Ilim)`; se R1 abriu, `I = 0`.
- **C1:** `C·dV/dt = I_fonte(V) − I_fuga(V,T)`, resolvido de forma implícita a cada 5 ms (bisseção; estável mesmo no modo zener).
  - Fuga: `0,01·C·V` (mín. 3 µA) até a nominal, subindo exponencialmente até a ruptura do óxido `Vbd = 1,35·VR·(1 − 0,003·(T − 25))`, e acima disso conduz como zener (0,5 Ω). Reverso: aguenta ~1 V, depois conduz.
  - Calor: `P = |V·I_fuga| + I_C²·ESR`; `dT/dt = (P − (T − Ta)/Rth)/Cth`.
  - Gás: `dn/dt = η·(I_fuga − 10·I_DCL)/(2F)` mols de H₂ (Faraday), com permeação lenta pela borracha.
  - Pressão manométrica: ar aquecido + vapor d'água do eletrólito (Clausius-Clapeyron) + H₂ no volume livre.
  - Estados: estressado → zener → estufando (40 % da pressão de abertura) → **válvula aberta** (falha aberta, ou curto se a fonte passa de 4× a nominal) → **rompido** apenas com a válvula obstruída.
- **R1:** `P = I²R`; `dT/dt = (P − (T − Ta)/200)/Cth`. Estados: acima de 155 °C (fora do datasheet) → laca escurece → fumaça → abre.
- **D1:** Shockley com resistência série, `V = n·Vt·ln(I/Is + 1) + I·Rs − 0,0019·(T − 25)`, ajustado para 1,9 V a 10 mA. Junção com RthJA 560 °C/W. Acima de 125 °C o brilho degrada; epóxi danificado reduz o brilho de vez; fio de ouro funde por I²t acima de ~0,32 A; chip abre por superaquecimento. Reverso: avalanche acima da ruptura.

## Premissas declaradas

Datasheets não publicam tudo. Estes valores são estimativas físicas, ficam em `ASSUMPTIONS` e aparecem no botão **Ver fontes**:

| Premissa | Valor | Por quê |
| --- | --- | --- |
| Capacidade térmica do SFR25 | 0,2 J/K | Corpo 0207 de ~0,25 g |
| Laca escurece / fuma / filme abre | 230 / 330 / 650 °C | Pirólise da laca e oxidação do filme |
| Formação do óxido | 1,35 × VR | CDE: "≥ 35 % acima" |
| ESR de C1 | 2,1 Ω | tan δ 0,16 a 120 Hz em 100 µF |
| Rth / Cth de C1 | 150 K/W / 0,8 J/K | Lata radial 6,3 × 11 mm |
| Eficiência de gás | 0,5 | Fração da fuga excedente que vira H₂ |
| Volume livre da lata | 0,05 mL | Lata pequena quase cheia |
| Abertura da válvula | 500 kPa manométricos | Faixa típica de centenas de kPa; sem valor publicado para esta lata |
| Estouro com válvula obstruída | 2,5 × a abertura | A borracha ou a lata cede |
| LED: Rs, n, Cth | 10 Ω, 2, 0,01 J/K | Ajuste ao datasheet; constante térmica ~5 s |
| LED: ruptura reversa | 20 V | Real fica bem acima dos 5 V garantidos e varia por lote |
| LED: fio de ouro | 0,32 A | Preece para fio de 25 µm |

## Desfechos calculados (25 °C)

| Cenário | Sequência |
| --- | --- |
| 12 V via 1 kΩ | Carrega em ~0,5 s; nada esquenta |
| 32 V via 1 kΩ | C1 trava em ~21,6 V, ~10 mA de fuga; aquece ~35 °C; estufa em ~2 min; válvula em ~6 min |
| 1.600 V via 1 kΩ, 200 mA | Fonte em corrente constante; R1 com 40 W passa de 155 °C em 0,7 s, escurece em 1 s, fuma em 1,5 s e abre em ~3,3 s; com mais de 500 V no vão pode arquear (não modelado); C1 fica a ~40 °C e sobrevive estressado |
| 30 V / 3 A / 0,1 Ω | Válvula abre em ~1 s, sem fragmentos |
| Válvula obstruída | Estouro em ~2 s |
| C1 invertido, 1 A | Válvula em ~4 s |
| LED 12 V / 100 Ω | ~92 mA; junção > 125 °C em ~7 s; degrada |
| LED 5 V sem resistor | ~280 mA; chip abre em ~2 s |
| LED invertido 30 V | Avalanche a 20 V, ~30 mA; chip abre em ~10 s |

**Limites honestos:** os tempos dependem das premissas e mudam com montagem, lote e ventilação. O modelo não calcula arco elétrico, chama, trajetória de fragmentos, envelhecimento ao longo de anos nem a curva de pulsos do SFR25.

## Validação

`node tests/all.mjs` roda 16 grupos elétricos e térmicos e 8 digitais. Os elétricos conferem a lei RC, a convergência do passo, o limite da fonte, a fuga nominal de 16 µA, o modo zener, o ensaio de sobrecarga do SFR25 (6,25 × Pn por 5 s **sem** queimar), "só rompe com a válvula obstruída", o ensaio reverso a 1 A e a curva do LED. Os mesmos testes rodam em **Bancada → Validação**.
