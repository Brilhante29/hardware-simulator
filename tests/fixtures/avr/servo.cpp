#include <Arduino.h>
#include <Servo.h>
Servo s;
void setup(){ s.attach(9); s.write(90); tone(8, 440); }
void loop(){}
