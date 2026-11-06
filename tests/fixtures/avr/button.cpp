#include <Arduino.h>
void setup(){ pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); Serial.begin(9600); }
int last = -1;
void loop(){ int v = digitalRead(2); digitalWrite(13, v == LOW ? HIGH : LOW); if (v != last) { Serial.print("btn="); Serial.println(v); last = v; } delay(5); }
