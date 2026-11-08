# Os mesmos firmwares, compilados para o Mega 2560

Cada `.hex` aqui vem do `.cpp` de mesmo nome em `../` (e do `.deps.txt`, quando há), compilado com `board = megaatmega2560`.
Única mudança no fonte: `aref` usa `analogReference(INTERNAL1V1)`, porque o núcleo do Mega não tem `INTERNAL`.
`node tests/avr.mjs` roda a suíte do Uno uma segunda vez com estes arquivos, trocando só os pinos que mudam de lugar
(PCINT0 no D53, AIN0/AIN1 em PE2/D5, ICP1 em PD4, SS no D53).
