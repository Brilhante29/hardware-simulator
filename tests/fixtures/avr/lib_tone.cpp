#include <Arduino.h>
// tone() com duração: 1 kHz por 200 ms no D8, depois 2,5 kHz contínuo no D9 até noTone em 1 s.
void setup() { Serial.begin(115200); tone(8, 1000, 200); delay(400); tone(9, 2500); delay(600); noTone(9); Serial.println("fim"); }
void loop() {}
