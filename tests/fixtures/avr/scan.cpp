#include <Arduino.h>
#include <Wire.h>
void setup(){ Serial.begin(115200); Wire.begin(); for (uint8_t a = 1; a < 127; a++) { Wire.beginTransmission(a); if (Wire.endTransmission() == 0) { Serial.print("0x"); Serial.println(a, HEX); } } Serial.println("fim"); }
void loop(){}
