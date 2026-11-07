#include <Arduino.h>
// Placa A: envia "ping N" pela serial a cada 200 ms.
uint16_t n = 0;
void setup(){ Serial.begin(9600); }
void loop(){ Serial.print("ping "); Serial.println(n++); delay(200); }
