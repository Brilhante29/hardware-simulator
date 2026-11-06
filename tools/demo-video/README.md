# Tour em vídeo

Grava `docs/media/hardware-studio-tour.mp4` (1920×1080, 30 fps, ~1min50) navegando pelo site com Playwright.
A camada de gravação, injetada só durante a captura, adiciona transições em blocos de pixel, zoom de câmera,
legendas curtas e cursor. O site em si não é alterado. A trilha chiptune e os efeitos são sintetizados por
`synth.py` (numpy), sincronizados com os eventos registrados: cliques, moedas das descobertas, rupturas e transições.

```sh
tools/demo-video/run.sh            # grava os 5 capítulos e monta o vídeo
tools/demo-video/run.sh 3          # regrava só o capítulo 3; depois rode build.sh
```

Requer node, ffmpeg, python3 com numpy e o pacote `playwright` com Chromium.

| Capítulo | Conteúdo |
| --- | --- |
| 1 Oficina | Entrada animada, 32 V, 100× com ruptura, troca, robô, descobertas completas, tema escuro, cartuchos |
| 2 Bancada | 1.600 V com falha em curto, cadeia causal, LED sobrecarregado, biblioteca e 24/24 testes |
| 3 Editor | Semáforo com travessia, dois Unos em sincronia, alarme Uno + ESP32 com a placa como peça personalizada |
| 4 Lógica e testes | SN74HC595 com bytes e OE; saída real de `tests/all.mjs` e `tests/display-contrast.mjs` |
| 5 Final | Créditos |

Os projetos do capítulo 3 estão em `projects/` e podem ser importados no editor como JSON nativo.
