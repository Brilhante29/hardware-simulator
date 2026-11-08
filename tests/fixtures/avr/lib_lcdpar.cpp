#include <Arduino.h>
#include <LiquidCrystal.h>
// LCD 16x2 direto nos pinos, fiação do exemplo oficial: RS=12, EN=11, D4=5, D5=4, D6=3, D7=2.
// Depois de createChar o endereço fica na CGRAM (como no HD44780 real): sem setCursor o texto iria para lá.
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
byte heart[8] = {0, 10, 31, 31, 14, 4, 0, 0};
void setup() { lcd.begin(16, 2); lcd.createChar(0, heart); lcd.setCursor(0, 0); lcd.print("LiquidCrystal"); lcd.setCursor(0, 1); lcd.print("t="); lcd.write((byte)0); }
void loop() { lcd.setCursor(4, 1); lcd.print(millis() / 1000); }
