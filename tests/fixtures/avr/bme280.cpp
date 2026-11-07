#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
Adafruit_BME280 bme;
void setup(){ Serial.begin(115200); if (!bme.begin(0x76)) { Serial.println("sem bme"); return; } }
void loop(){ Serial.print(bme.readTemperature(), 2); Serial.print(' '); Serial.print(bme.readPressure() / 100.0F, 2); Serial.print(' '); Serial.println(bme.readHumidity(), 2); delay(500); }
