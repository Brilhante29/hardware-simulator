#include <Arduino.h>
#include <DHT.h>
DHT dht(4, DHT11);
void setup(){ Serial.begin(115200); dht.begin(); }
void loop(){ delay(2100); float h = dht.readHumidity(), t = dht.readTemperature(); if (isnan(h) || isnan(t)) { Serial.println("falha"); return; } Serial.print(t, 1); Serial.print(' '); Serial.println(h, 1); }
