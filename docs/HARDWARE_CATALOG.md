# Catálogo oficial e perfil wearable

Este índice reúne 54 placas, SoCs, sensores, periféricos e componentes de múltiplos fabricantes. Os links levam a páginas oficiais ou documentação do mantenedor; use essas páginas para obter a revisão atual do datasheet, erratas, manual de referência, esquemáticos e pinout. A presença no índice não significa que o componente já esteja simulado.

## Wearable Stroke Alert

O artigo de Marques et al., SBESC 2024, “Wearable Stroke Alert System - New Health of Things Approach Based on Generative AI and Datafusion for Real-Time Stroke Monitoring” (DOI 10.1109/SBESC65055.2024.10771817), propõe monitoramento wearable com fusão de dados, processamento em edge e alertas. O material localizado não determina uma BOM completa nem modelos exatos de MCU/sensores. Assim, o conjunto abaixo é uma proposta de prototipagem, não uma reprodução literal do artigo:

- MCU para comparar: nRF52840, STM32U5, ESP32-S3 ou RP2350.
- Movimento: BMI270, ICM-42688-P ou LSM6DSOX.
- PPG: MAX86141 ou MAX30102; ECG de bancada: ADS1292R ou AD8232.
- Temperatura: TMP117 ou MAX30205.
- Energia: MAX17048 e, para estudar carga/PMIC, BQ24074 ou BQ25120A.
- Interface e registro: SSD1306/ST7789, DRV2605L e W25Q128JV.

É um ambiente de pesquisa/educação eletrônica, não dispositivo médico nem detector clínico validado. Simular transações, registradores, sinais sintéticos e consumo estimado ajuda a testar firmware e arquitetura. Não demonstra desempenho diagnóstico nem representa medições reais de pacientes.

## Camadas de simulação

1. Visual/pinout: colocar, conectar e importar componentes.
2. GPIO e temporização.
3. Protocolo, mapa de registradores e interrupções.
4. Fontes determinísticas de sinais (IMU, PPG, ECG, temperatura), com fixtures identificadas como sintéticas.
5. Modelagem analógica/energia.
6. Execução de firmware no MCU.

O protótipo atual cobre apenas comportamento digital básico e operações limitadas de sketch. Não compila C++ real, emula MCUs, sensores por I2C/SPI nem resolve circuitos analógicos. Os níveis no JSON são metas planejadas. Componentes com revisões múltiplas ou origens OEM (por exemplo módulos comuns) precisam de datasheet do fabricante exato.

## Política para adicionar hardware

- Prefira URL oficial de fabricante/mantenedor e datasheet específico do part number.
- Guarde a URL de origem, revisão/data consultada e tipos de documentos necessários; não copie PDFs protegidos para o repositório.
- Separe dados extraídos do datasheet dos modelos executáveis.
- Partes sem modelo permanecem importáveis como visuais e devem indicar claramente essa limitação.
- Ecossistema mundial é grande e muda continuamente; este seed é extensível, não uma alegação de cobertura completa.

Veja [hardware-catalog.json](../data/hardware-catalog.json).
