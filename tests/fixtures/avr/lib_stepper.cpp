#include <Arduino.h>
#include <Stepper.h>
// Stepper de 200 passos (4 fios) nos pinos 8..11: 10 passos para frente, 3 para trás, a 60 RPM.
Stepper motor(200, 8, 9, 10, 11);
void setup() { Serial.begin(115200); motor.setSpeed(60); motor.step(10); motor.step(-3); Serial.println("ok"); }
void loop() {}
