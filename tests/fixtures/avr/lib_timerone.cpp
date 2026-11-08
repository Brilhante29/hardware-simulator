#include <Arduino.h>
#include <TimerOne.h>
// TimerOne: interrupção a cada 1 ms e PWM de 25 % a 1 kHz no D9 (Uno) / D11 (Mega), pinos do OC1A.
volatile unsigned long ticks = 0;
void tick() { ticks++; }
#if defined(__AVR_ATmega2560__)
const int PWM_PIN = 11;
#else
const int PWM_PIN = 9;
#endif
void setup() { Serial.begin(115200); Timer1.initialize(1000); Timer1.attachInterrupt(tick); Timer1.pwm(PWM_PIN, 256); delay(500); noInterrupts(); unsigned long t = ticks; interrupts(); Serial.println(t); }
void loop() {}
