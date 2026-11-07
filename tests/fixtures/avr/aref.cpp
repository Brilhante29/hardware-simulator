#include <Arduino.h>
void setup(){ Serial.begin(115200); analogReference(INTERNAL); analogRead(A0); delay(10); Serial.println(analogRead(A0)); analogReference(DEFAULT); analogRead(A0); delay(10); Serial.println(analogRead(A0)); }
void loop(){}
