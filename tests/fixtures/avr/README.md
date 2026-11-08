# Firmwares de teste

Compilados com PlatformIO (`platform = atmelavr`, `framework = arduino`). Os arquivos `mega_*` usam `board = megaatmega2560`;
os demais, `board = uno`. Cada `.cpp` é o fonte do `.hex` ao lado; `.deps.txt` lista o `lib_deps` quando há bibliotecas.
Para recompilar: crie um projeto PlatformIO com o `.cpp` em `src/main.cpp` e rode `pio run`.
O `mega_big` também precisa de `src/tables.h`, gerado por `python3 mega_big.tables.py > src/tables.h`.
