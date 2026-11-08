#include <Arduino.h>
#include <EEPROM.h>
#include <Servo.h>
// ADC0, ADC8 e ADC15 (MUX5), referência interna de 2,56 V, EEPROM de 4 KB e Servo (Timer5 no Mega).
Servo s;
void setup() {
  Serial.begin(115200);
  Serial.println(analogRead(A0)); Serial.println(analogRead(A8)); Serial.println(analogRead(A15));
  analogReference(INTERNAL2V56); analogRead(A0); delay(5); Serial.println(analogRead(A0));
  analogReference(INTERNAL1V1); analogRead(A0); delay(5); Serial.println(analogRead(A0));
  Serial.println(EEPROM.length());
  uint8_t n = EEPROM.read(4095); EEPROM.write(4095, n + 1); Serial.println(EEPROM.read(4095));
  s.attach(9); s.write(45);
}
void loop() {}
