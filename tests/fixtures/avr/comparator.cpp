#include <Arduino.h>
// Comparador analógico: AIN0 (D6) contra AIN1 (D7); interrupção a cada cruzamento.
volatile uint16_t crossings = 0;
ISR(ANALOG_COMP_vect){ crossings++; }
void setup(){ Serial.begin(115200); ACSR = _BV(ACI) | _BV(ACIE); }
void loop(){ static uint32_t t = 0; if (millis() - t >= 100) { t = millis(); Serial.print((ACSR & _BV(ACO)) ? 1 : 0); Serial.print(','); Serial.println(crossings); } }
