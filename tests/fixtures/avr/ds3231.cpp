#include <Arduino.h>
#include <Wire.h>
#include <RTClib.h>
RTC_DS3231 rtc;
void setup(){ Serial.begin(115200); if (!rtc.begin()) { Serial.println("sem rtc"); return; }
  if (rtc.lostPower()) { rtc.adjust(DateTime(2026, 11, 7, 23, 59, 58)); Serial.println("ajustado"); } }
void loop(){ DateTime n = rtc.now(); char b[24]; sprintf(b, "%04d-%02d-%02d %02d:%02d:%02d", n.year(), n.month(), n.day(), n.hour(), n.minute(), n.second()); Serial.print(b); Serial.print(' '); Serial.println(rtc.getTemperature(), 2); delay(1000); }
