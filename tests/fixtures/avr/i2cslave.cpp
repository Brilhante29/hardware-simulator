#include <Arduino.h>
#include <Wire.h>
// Escravo no endereço 8: imprime o que recebe e responde "hello " quando pedem.
void receiveEvent(int n){ while (Wire.available() > 1) Serial.print((char)Wire.read()); Serial.println((int)Wire.read()); }
void requestEvent(){ Wire.write("hello "); }
void setup(){ Serial.begin(115200); Wire.begin(8); Wire.onReceive(receiveEvent); Wire.onRequest(requestEvent); }
void loop(){ delay(100); }
