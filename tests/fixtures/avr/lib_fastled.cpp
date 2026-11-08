#include <Arduino.h>
#include <FastLED.h>
// FastLED (laço em assembly com tempo contado em ciclos) num WS2812B de 4 LEDs no D6.
CRGB leds[4];
void setup() { FastLED.addLeds<WS2812B, 6, GRB>(leds, 4); leds[0] = CRGB(255, 0, 0); leds[1] = CRGB(0, 255, 0); leds[2] = CRGB(0, 0, 255); leds[3] = CRGB(18, 52, 86); FastLED.setBrightness(255); FastLED.show(); }
void loop() {}
