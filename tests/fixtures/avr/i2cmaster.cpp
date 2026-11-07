#include <Arduino.h>
#include <Wire.h>
// Mestre: escreve um contador no escravo 8 e pede 6 bytes de volta.
byte x = 0;
void setup(){ Serial.begin(115200); Wire.begin(); }
void loop(){ Wire.beginTransmission(8); Wire.write("x is "); Wire.write(x); byte err = Wire.endTransmission();
  Wire.requestFrom(8, 6); String r; while (Wire.available()) r += (char)Wire.read();
  Serial.print("tx="); Serial.print(err); Serial.print(" rx="); Serial.println(r); x++; delay(100); }
