#include <Arduino.h>
void setup(){ Serial.begin(115200); analogWrite(9, 64); analogWrite(5, 191); analogWrite(11, 128); Serial.println("pwm"); }
void loop(){}
