#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup(){ lcd.init(); lcd.backlight(); lcd.setCursor(0, 0); lcd.print("Hardware Studio"); lcd.setCursor(0, 1); lcd.print("Uno no I2C :)"); }
void loop(){ lcd.setCursor(14, 1); lcd.print(millis() / 1000 % 10); delay(200); }
