# Adaptadores de IDE e toolchain

O simulador deve deixar o usuário escolher onde o código vive e como é compilado. Arduino IDE e PlatformIO são fluxos de primeira classe: o projeto não pode ficar preso ao editor interno. O objetivo do plugin/adaptador é gerar ou abrir a estrutura de projeto correta, validar a placa, chamar a ferramenta configurada e importar artefatos e logs de volta.

## Adaptadores planejados

| Adaptador | Entrada/saída esperada | Referência oficial |
|---|---|---|
| Arduino IDE / Arduino CLI | sketch e bibliotecas; FQBN/placa; compilar, upload, monitor serial; importar binários e logs | [Arduino CLI](https://docs.arduino.cc/arduino-cli/) |
| PlatformIO | platformio.ini, board ID, framework e libs; build/upload/monitor; importar ELF/map/log | [PlatformIO Core](https://docs.platformio.org/page/core/index.html) |
| ESP-IDF | projeto CMake, target ESP32, sdkconfig; build/flash/monitor | [ESP-IDF para ESP32-S3](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/index.html) |
| Zephyr / west | board target e build directory; build/flash/debug/attach | [west build/flash/debug](https://docs.zephyrproject.org/latest/develop/west/build-flash-debug.html) |
| NXP MCUXpresso SDK | projeto SDK/CMake, board target; build/debug | [Documentação do SDK](https://docs.mcuxpresso.nxp.com/mcuxsdk/latest/index.html) |
| STM32Cube | configuração MCU/placa e projeto Cube; build/debug | [Documentação STM32U5](https://www.st.com/en/microcontrollers-microprocessors/stm32u5-series/documentation.html) |

## Contrato de plugin

Cada adaptador deve declarar:

- `id`, nome, versão e executável/endpoint local;
- famílias de placa/SoC e frameworks suportados;
- forma de importar/gerar projeto (não reformatar ou substituir arquivos sem consentimento);
- comandos/capacidades disponíveis: detectar, compilar, carregar, monitorar, depurar;
- formatos de artefato aceitos: ELF, HEX, BIN, map e logs;
- variáveis de ambiente e requisitos, sem copiar segredos para projeto;
- saída estruturada com comando, código de retorno, stdout/stderr, duração, versão de toolchain e hashes dos artefatos.

Exemplo conceitual de manifesto:

```json
{
  "id": "platformio-core",
  "kind": "local-cli",
  "projectFiles": ["platformio.ini", "src/**", "include/**"],
  "capabilities": ["detect", "build", "upload", "monitor"],
  "artifacts": ["elf", "hex", "bin", "map"],
  "targetsFrom": "platformio.ini"
}
```

## Execução local e compatibilidade

Uma página web estática não pode executar arbitrariamente Arduino CLI ou `pio` no computador do usuário. A conexão de verdade exige uma fronteira local explícita: extensão de editor, companion local com API limitada, ou app desktop. A versão inicial deve exportar/importar arquivos de projeto e abrir instruções para IDE externa; a próxima pode adicionar um companion local controlado pelo usuário. Build/upload só deve ocorrer após ação explícita no app, com caminhos e comandos visíveis.

Os adaptadores devem ser independentes do motor de simulação. Se não houver emulador confiável para determinado SoC, ainda deve ser possível editar o código, compilar com a toolchain real, visualizar a montagem e executar modelos de periférico/sinais em simulação parcial. O sistema reportará claramente quais partes foram simuladas, executadas em hardware real ou apenas visualizadas.

## Estado

Este contrato descreve a arquitetura futura. O protótipo atual ainda não carrega plugins, inicia IDEs, executa CLI local ou compila firmware.
