#include <Arduino.h>
// INT4 (D2), INT5 (D3), INT3 (D18), INT0 (D21) e PCINT2 na porta K (A8).
volatile uint16_t c2 = 0, c3 = 0, c18 = 0, c21 = 0, ck = 0;
ISR(PCINT2_vect) { ck++; }
void setup() {
  Serial.begin(115200);
  const uint8_t ps[] = {2, 3, 18, 21}; for (uint8_t p : ps) pinMode(p, INPUT_PULLUP);
  pinMode(A8, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), [] { c2++; }, FALLING);
  attachInterrupt(digitalPinToInterrupt(3), [] { c3++; }, RISING);
  attachInterrupt(digitalPinToInterrupt(18), [] { c18++; }, CHANGE);
  attachInterrupt(digitalPinToInterrupt(21), [] { c21++; }, FALLING);
  PCMSK2 = 1; PCICR |= 1 << PCIE2;
  Serial.println("irq");
}
void loop() {
  static unsigned long t = 0;
  if (millis() - t >= 100) { t += 100; noInterrupts(); uint16_t a = c2, b = c3, c = c18, d = c21, e = ck; interrupts();
    char buf[48]; snprintf(buf, sizeof buf, "%u %u %u %u %u", a, b, c, d, e); Serial.println(buf); }
}
