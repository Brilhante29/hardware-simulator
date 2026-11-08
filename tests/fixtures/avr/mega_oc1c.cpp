#include <Arduino.h>
// D13 (PB7) também é OC1C: PWM rápido de 10 bits do Timer1 no canal C, ligado direto pelos registradores.
void setup() {
  pinMode(13, OUTPUT);
  TCCR0A &= ~(_BV(COM0A1) | _BV(COM0A0));          // solta o OC0A
  TCCR1A = _BV(COM1C1) | _BV(WGM11) | _BV(WGM10);   // fast PWM 10 bits, OC1C não invertido
  TCCR1B = _BV(WGM12) | _BV(CS10);
  OCR1C = 255;                                       // (255 + 1) / 1024 = 25 %
  Serial.begin(115200); Serial.println("oc1c");
}
void loop() {}
