#include <Arduino.h>
// HC-SR04 do jeito dos tutoriais: TRIG no 9, ECHO no 10, pulseIn e distância = tempo × 0,0343 / 2.
const int TRIG = 9, ECHO = 10;
void setup() { Serial.begin(115200); pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); }
void loop() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2); digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 40000UL);
  Serial.print(us); Serial.print(' '); Serial.println(us * 0.0343 / 2, 1); delay(60);
}
