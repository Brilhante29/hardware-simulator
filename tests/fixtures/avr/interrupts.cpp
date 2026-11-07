#include <Arduino.h>
volatile uint16_t falls = 0, changes = 0;
void onFall(){ falls++; }
ISR(PCINT0_vect){ changes++; }
void setup(){ Serial.begin(115200); pinMode(2, INPUT_PULLUP); pinMode(8, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onFall, FALLING);
  PCICR |= _BV(PCIE0); PCMSK0 |= _BV(PCINT0); Serial.println("ok"); }
void loop(){ static uint32_t t = 0; if (millis() - t >= 100) { t = millis(); noInterrupts(); uint16_t f = falls, c = changes; interrupts(); Serial.print(f); Serial.print(','); Serial.println(c); } }
