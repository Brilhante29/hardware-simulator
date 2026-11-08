#include <Arduino.h>
#include <avr/pgmspace.h>
#include "tables.h"
// 128 KB de tabelas em PROGMEM empurram o código para além de 64 K palavras: testa ELPM (RAMPZ), JMP/CALL longos,
// trampolins de ponteiro de função (EICALL) e a cópia de .data, que vem do fim da flash.
char msg[] = "dados na RAM";
uint32_t sum(uint_farptr_t p, uint16_t n) { uint32_t s = 0; for (uint16_t i = 0; i < n; i++) s += pgm_read_byte_far(p + i); return s; }
typedef uint32_t (*Fn)(uint_farptr_t, uint16_t);
volatile Fn fn = sum;
void setup() {
  Serial.begin(115200); Serial.println(msg);
  Serial.println(fn(pgm_get_far_address(tab0), 32000)); Serial.println(fn(pgm_get_far_address(tab1), 32000));
  Serial.println(fn(pgm_get_far_address(tab2), 32000)); Serial.println(fn(pgm_get_far_address(tab3), 32000));
  Serial.println(fn(pgm_get_far_address(tab4), 8000));
  Serial.print("tab4 em 0x"); Serial.println((uint32_t)pgm_get_far_address(tab4), HEX);
}
void loop() {}
