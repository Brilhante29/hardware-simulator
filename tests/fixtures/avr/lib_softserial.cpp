#include <Arduino.h>
#include <SoftwareSerial.h>
// SoftwareSerial: RX no D10 (PCINT), TX no D11, 9600 baud. Ecoa em maiúsculas pela serial em software e conta na Serial.
SoftwareSerial soft(10, 11);
void setup() { Serial.begin(115200); soft.begin(9600); soft.println("soft ola"); Serial.println("pronto"); }
void loop() { while (soft.available()) { char c = soft.read(); soft.write(toupper(c)); Serial.print(c); } }
