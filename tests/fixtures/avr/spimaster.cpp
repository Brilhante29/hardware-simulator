#include <Arduino.h>
#include <SPI.h>
void setup(){ Serial.begin(115200); pinMode(SS, OUTPUT); digitalWrite(SS, HIGH); SPI.begin(); SPI.setClockDivider(SPI_CLOCK_DIV16); }
void loop(){ digitalWrite(SS, LOW); byte a = SPI.transfer(0x11); delayMicroseconds(20); byte b = SPI.transfer(0x22); delayMicroseconds(20); byte c = SPI.transfer(0x00); digitalWrite(SS, HIGH);
  Serial.print(a, HEX); Serial.print(' '); Serial.print(b, HEX); Serial.print(' '); Serial.println(c, HEX); delay(100); }
