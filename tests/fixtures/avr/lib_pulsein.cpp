#include <Arduino.h>
// pulseIn (laço calibrado em ciclos), shiftOut/shiftIn bit a bit e micros().
void setup() {
  Serial.begin(115200); pinMode(7, INPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(6, INPUT);
  unsigned long hi = pulseIn(7, HIGH, 100000UL), lo = pulseIn(7, LOW, 100000UL);
  Serial.print(hi); Serial.print(' '); Serial.println(lo);
  shiftOut(4, 5, MSBFIRST, 0xA5); shiftOut(4, 5, LSBFIRST, 0x3C);
  Serial.println(shiftIn(6, 5, MSBFIRST), HEX);
  unsigned long t = micros(); delayMicroseconds(1000); Serial.println(micros() - t);
}
void loop() {}
