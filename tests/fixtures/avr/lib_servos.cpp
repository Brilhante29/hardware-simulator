#include <Arduino.h>
#include <Servo.h>
// 12 servos nos pinos 2..13, de 0° a 165° em passos de 15°.
Servo s[12];
void setup() { for (int i = 0; i < 12; i++) { s[i].attach(2 + i); s[i].write(i * 15); } }
void loop() {}
