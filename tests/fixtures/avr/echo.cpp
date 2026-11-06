#include <Arduino.h>
void setup(){ Serial.begin(9600); Serial.println("pronto"); }
void loop(){ while (Serial.available()) { char c = Serial.read(); Serial.write(c >= 'a' && c <= 'z' ? c - 32 : c); } }
