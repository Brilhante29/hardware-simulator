// TMP117 por Wire puro: identificação (0x0F) e temperatura (0x00, 7,8125 m°C por bit), a cada 500 ms.
#include <Arduino.h>
#include <Wire.h>
const uint8_t ADDR = 0x48;
int16_t reg16(uint8_t r) { Wire.beginTransmission(ADDR); Wire.write(r); Wire.endTransmission(false); Wire.requestFrom(ADDR, (uint8_t)2); return (Wire.read() << 8) | Wire.read(); }
void setup() { Serial.begin(115200); Wire.begin(); Serial.print(F("id=")); Serial.println((uint16_t)reg16(0x0F), HEX); }
void loop() { Serial.print(F("t=")); Serial.println(reg16(0x00) * 0.0078125, 2); delay(500); }
