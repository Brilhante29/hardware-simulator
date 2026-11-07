#include <Arduino.h>
#include <SPI.h>
void setup(){ Serial.begin(115200); pinMode(10, OUTPUT); SPI.begin(); SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(10, LOW); uint8_t a = SPI.transfer(0xA5); uint8_t b = SPI.transfer(0x3C); digitalWrite(10, HIGH); SPI.endTransaction();
  Serial.print(a, HEX); Serial.print(' '); Serial.println(b, HEX); }
void loop(){}
