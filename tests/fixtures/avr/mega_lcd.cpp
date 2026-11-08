#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
// I²C no Mega fica em D20 (SDA) e D21 (SCL).
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() { lcd.init(); lcd.backlight(); lcd.setCursor(0, 0); lcd.print("Mega 2560"); lcd.setCursor(0, 1); lcd.print("256 KB flash"); }
void loop() {}
