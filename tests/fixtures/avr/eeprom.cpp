#include <Arduino.h>
#include <EEPROM.h>
struct Cfg { uint16_t boots; float gain; char name[6]; };
void setup(){ Serial.begin(115200); Cfg c; EEPROM.get(0, c);
  if (c.boots == 0xFFFF) { c.boots = 0; c.gain = 1.5f; strcpy(c.name, "uno"); }
  c.boots++; EEPROM.put(0, c); EEPROM.update(100, 42);
  Cfg r; EEPROM.get(0, r); Serial.print(r.boots); Serial.print(' '); Serial.print(r.gain, 2); Serial.print(' '); Serial.print(r.name); Serial.print(' '); Serial.println(EEPROM.read(100)); }
void loop(){}
