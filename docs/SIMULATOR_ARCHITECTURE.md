# Arquitetura para experimentar hardware ponta a ponta

O simulador deve aceitar desde uma lista de materiais sobre protoboard até uma PCB desenhada pelo usuário e firmware compilado. Isso é uma direção de produto e uma arquitetura-alvo; não é capacidade entregue no simulador atual.

## O mesmo projeto, várias implementações

Um projeto descreve a função desejada e pode ter várias variantes físicas. Cada variante aponta para uma placa/SoC, sensores, alimentação, pinagem, layout e toolchain próprios. Trocar ESP32-S3 por nRF52840, por exemplo, deve sinalizar incompatibilidades de tensão, pinos, interfaces, memória e firmware sem apagar o circuito original.

Exemplo de wariantes para o wearable:

| Variante | MCU/SoC | Firmware | O que comparar |
|---|---|---|---|
| A | ESP32-S3 | ESP-IDF | conectividade e processamento local |
| B | nRF52840 | Zephyr ou nRF Connect SDK | BLE e orçamento de energia |
| C | STM32U5 | STM32Cube / toolchain suportada | MCU de baixo consumo e periféricos |
| D | RP2350 | Pico SDK | aquisição e prototipação geral |

Essas são opções para experimentos, não indicação clínica ou resultado de benchmark. A escolha deve ser medida com o mesmo conjunto de estímulos e workloads.

## Camadas e fronteiras

1. **Projeto lógico** — objetivo, diagrama de blocos, interfaces requeridas, cenários de ensaio, hipóteses e métricas.
2. **Esquemático e conectividade** — componentes identificados por part number, pinos elétricos, redes, regras de tensão e ERC.
3. **PCB** — encapsulamentos e footprints, posicionamento, camadas/cobre, regras, DRC, arquivos Gerber/IPC-2581 quando disponíveis.
4. **Catálogo de componentes** — fonte oficial/revisão, package, pinout, interfaces, limites elétricos, modelos executáveis separados dos metadados.
5. **Modelo de simulação** — digital/pinos, barramentos e registradores, sensores com sinais reprodutíveis, analog/energia, eventualmente SPICE.
6. **Firmware e toolchain** — target, compilador, SDK, flags, linker script, firmware binário/ELF, logs UART, debugger e traces.
7. **Avaliação** — comparar variantes com entradas idênticas: latência, memória, energia estimada, amostras perdidas e comportamento em falha.

A importação/exportação deve manter IDs estáveis de componentes e redes. Uma peça ausente no catálogo pode ser criada pelo usuário com pinos, footprint, parâmetros e modelo de comportamento carregável. A ausência de modelo nunca deve bloquear abrir o projeto.

## Plano de interoperabilidade

- **EDA**: KiCad como primeiro formato de placa aberto a importar/exportar (esquemático e PCB); manter JSON interno do simulador simples e versionado.
- **Firmware**: primeiro usar artefatos produzidos fora (ELF/HEX/BIN, logs e metadados de build); depois conectar toolchains individuais em adaptadores isolados.
- **Executores**: começar com modelos digitais/eventos de baixo custo; firmware real só em backend isolado, usando simuladores/emuladores por ISA/SoC quando houver suporte real.
- **Dados de sensor**: fixtures CSV/JSON para IMU, PPG, ECG e temperatura, com unidade, taxa, origem e indicação sintética ou dataset. Não tratar sinal sintético como dado clínico.
- **PCB física**: modelo 2D primeiro. Campo eletromagnético, integridade de sinal e termal são escopos próprios, não consequência automática de ter uma visualização da PCB.

## Configuração de variantes

O arquivo [wearable-platform-matrix.json](../examples/wearable-platform-matrix.json) representa a estrutura para comparar plataformas. Campos de pinout/firmware são variáveis de projeto; devem ser preenchidos a partir de datasheets oficiais e documentação atual. Este formato ainda é um contrato inicial sujeito a versão.

## O que existe hoje

A primeira versão do Hardware Simulator é um editor local leve, com circuito digital básico, exemplos, projetos JSON e importação parcial de diagramas Wokwi. Ainda não tem editor de esquemático/PCB, ERC/DRC, pinout completo dos MCUs, compilação de firmware, emulação de SoC ou resolução analógica. O catálogo de 54 fontes é índice de documentos, não uma biblioteca de 54 modelos operacionais.

## Documentação oficial de software

- ESP32-S3: [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/index.html)
- NXP: [MCUXpresso SDK](https://docs.mcuxpresso.nxp.com/mcuxsdk/latest/index.html)
- ST: [STM32U5 documentation](https://www.st.com/en/microcontrollers-microprocessors/stm32u5-series/documentation.html)
- nRF52840: [Nordic Product Specification](https://docs.nordicsemi.com/bundle/ps_nrf52840/page/keyfeatures_html5.html)
- PCB: [KiCad documentation](https://docs.kicad.org/)

Os links de fabricante/mantenedor apontam para documentação vigente; versões e suporte variam. O simulador deve registrar a versão exata usada em cada experimento.


Contrato detalhado para Arduino IDE, PlatformIO e outras toolchains: [TOOLCHAIN_ADAPTERS.md](TOOLCHAIN_ADAPTERS.md).