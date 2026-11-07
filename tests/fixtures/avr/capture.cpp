#include <Arduino.h>
// Captura de entrada do Timer1 no ICP1 (D8): mede o período de um sinal externo.
volatile uint16_t last = 0, period = 0; volatile uint8_t n = 0;
ISR(TIMER1_CAPT_vect){ uint16_t now = ICR1; period = now - last; last = now; n++; }
void setup(){ Serial.begin(115200); TCCR1A = 0; TCCR1B = _BV(ICES1) | _BV(CS11); TIMSK1 = _BV(ICIE1); }
void loop(){ delay(50); noInterrupts(); uint16_t p = period; uint8_t c = n; interrupts(); Serial.print(c > 2 ? p / 2 : 0); Serial.println(" us"); }
