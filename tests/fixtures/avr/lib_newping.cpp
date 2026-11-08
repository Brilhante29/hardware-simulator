#include <Arduino.h>
#include <NewPing.h>
// NewPing (laço próprio sobre micros()): TRIG 9, ECHO 10, até 300 cm.
NewPing sonar(9, 10, 300);
void setup() { Serial.begin(115200); }
void loop() { Serial.println(sonar.ping_cm()); delay(60); }
