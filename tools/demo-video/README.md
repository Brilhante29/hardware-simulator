# Tour em vídeo

Grava uma apresentação do Hardware Studio (1920×1080, 30 fps) navegando pelo site com Playwright.
Legendas, capítulos, cursor e destaques são uma camada injetada na página durante a gravação; o app não é alterado.

```sh
tools/demo-video/run.sh          # todos os capítulos -> docs/media/hardware-studio-apresentacao.mp4
tools/demo-video/run.sh 06       # só um capítulo (clipe em tools/demo-video/out/)
```

| Capítulo | Conteúdo |
| --- | --- |
| 01 Oficina | Canvas RC, 12 V / 32 V / 100×, robô, temas, cores acessíveis, cartuchos |
| 02 Bancada | Simulação RC, esquema, slider, 100× com falha em curto e aberta, cadeia causal |
| 03 LED | 330 Ω, sobrecarga 12 V / 100 Ω, limite da fonte, polaridade reversa, SFR25 a 70 °C |
| 04 Biblioteca | Busca ESP32/STM32/sensor, filtros, validação no navegador, export Arduino/PlatformIO |
| 05 Editor | Blink, edição do sketch, circuito do zero com fios, peça personalizada, desfazer/refazer |
| 06 Combinações | Semáforo com travessia sonora, dois Unos em sincronia, alarme Uno + ESP32 importado do Wokwi |
| 07 SN74HC595 | Bytes, latch, OE/Z, clear, comparação com o datasheet |
| 08 Testes | Saída real de `tests/all.mjs` e `tests/display-contrast.mjs` |
| 09 Encerramento | Tema escuro e créditos |

Os projetos do capítulo 06 estão em `projects/` e podem ser importados no editor.
O ESP32 do `diagram.json` entra sem fios porque o conversor Wokwi descarta conexões de peças
desconhecidas; o vídeo liga o serial à mão.
