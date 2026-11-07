#include <Arduino.h>
// Escravo SPI: devolve o byte recebido + 1 na próxima transferência e conta os bytes.
volatile byte next = 0xA0; volatile uint8_t count = 0;
ISR(SPI_STC_vect){ byte in = SPDR; SPDR = in + 1; count++; }
void setup(){ Serial.begin(115200); pinMode(MISO, OUTPUT); SPCR = _BV(SPE) | _BV(SPIE); SPDR = next; }
void loop(){ delay(100); Serial.print("bytes="); Serial.println(count); }
