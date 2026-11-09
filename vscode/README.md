# Hardware Studio para VS Code

Simula o firmware do seu projeto PlatformIO num circuito virtual, ao lado do código.

1. Abra uma pasta com `platformio.ini` (Arduino Uno, Nano ou Mega 2560).
2. **Hardware Studio: Simular projeto PlatformIO** (paleta de comandos ou o ícone no título de um `.cpp`).
3. Cada vez que você salva, o projeto é recompilado com o `pio` e o firmware novo roda no circuito.

O circuito fica em `hardware-studio.json` na pasta do projeto, versionado junto com o código. Precisa do PlatformIO instalado
(`pip install platformio` ou a extensão PlatformIO IDE); o caminho pode ser ajustado em `hardwareStudio.pioPath`.

Gerar o `.vsix`: `npm run package`. Testar sem abrir o VS Code: `npm test`.
