#include <Arduino.h>
#include <avr/wdt.h>
#include <avr/sleep.h>
volatile uint8_t ticks = 0;
ISR(WDT_vect){ ticks++; }
void setup(){ uint8_t why = MCUSR; MCUSR = 0; wdt_disable(); Serial.begin(115200);
  Serial.println(why & _BV(WDRF) ? "reset pelo watchdog" : "boot normal");
  if (!(why & _BV(WDRF))) { wdt_enable(WDTO_60MS); while (1) {} }
  // modo interrupção + sleep power-down: acorda a cada ~16 ms
  cli(); wdt_reset(); WDTCSR = _BV(WDCE) | _BV(WDE); WDTCSR = _BV(WDIE); sei();
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  for (int i = 0; i < 5; i++) { sleep_enable(); sleep_cpu(); sleep_disable(); }
  Serial.print("acordou "); Serial.println(ticks);
}
void loop(){}
