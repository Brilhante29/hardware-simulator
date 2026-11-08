#include <Arduino.h>
// analogWrite em todos os timers do Mega: T0 (D4, D13), T1 (D11, D12), T2 (D9, D10), T3 (D2, D3, D5), T4 (D6, D7, D8), T5 (D44, D45, D46).
const uint8_t pins[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46};
void setup() { for (uint8_t i = 0; i < sizeof pins; i++) analogWrite(pins[i], 16 * (i + 1)); Serial.begin(115200); Serial.println("pwm"); }
void loop() {}
