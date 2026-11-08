# Gera src/tables.h do firmware mega_big (128 KB + 8 KB em PROGMEM). Uso: python3 mega_big.tables.py > src/tables.h
for k in range(4):
    vals = [(((i * i) >> (3 + k)) + k * 37 + i // (k + 3)) & 0xff for i in range(32000)]
    print("const uint8_t tab%d[32000] PROGMEM = {%s};" % (k, ",".join(map(str, vals))))
print("const uint8_t tab4[8000] PROGMEM = {%s};" % ",".join(str((i * 31 + (i >> 5)) & 0xff) for i in range(8000)))
