#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
void setup(){ Serial.begin(115200); strip.begin(); strip.setPixelColor(0, 255, 0, 0); strip.setPixelColor(1, 0, 255, 0); strip.setPixelColor(2, 0, 0, 255); strip.setPixelColor(3, 18, 52, 86); strip.setPixelColor(7, 255, 255, 255); strip.show(); Serial.println("show"); delay(100);
  for (int i = 0; i < 8; i++) strip.setPixelColor(i, strip.Color(i * 30, 100, 255 - i * 30)); strip.show(); Serial.println("degrade"); }
void loop(){}
