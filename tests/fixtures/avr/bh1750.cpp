#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>
BH1750 lux;
void setup(){ Serial.begin(115200); Wire.begin(); if (!lux.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) { Serial.println("sem bh1750"); return; } }
void loop(){ Serial.println(lux.readLightLevel(), 1); delay(300); }
