// Painel de demonstração do Hardware Studio: pot → servo + LCD + OLED; botão → LED + bipe.
#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Servo.h>
#include <EEPROM.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
Servo servo;
const uint8_t BTN = 2, LED = 13, BUZ = 8, SERVO_PIN = 9, POT = A0;
bool ledOn = false; int lastBtn = HIGH; uint16_t presses;
void setup() {
  Serial.begin(115200); pinMode(BTN, INPUT_PULLUP); pinMode(LED, OUTPUT);
  EEPROM.get(0, presses); if (presses == 0xFFFF) presses = 0;
  lcd.init(); lcd.backlight(); lcd.print("Hardware Studio");
  bool okOled = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  servo.attach(SERVO_PIN);
  Serial.print("painel pronto · oled="); Serial.print(okOled); Serial.print(" · cliques salvos="); Serial.println(presses);
}
void loop() {
  int raw = analogRead(POT); int angle = map(raw, 0, 1023, 0, 180); servo.write(angle);
  int b = digitalRead(BTN);
  if (b == LOW && lastBtn == HIGH) { ledOn = !ledOn; presses++; EEPROM.put(0, presses); tone(BUZ, ledOn ? 880 : 440, 120); Serial.print("botão · LED "); Serial.println(ledOn ? "ligado" : "desligado"); }
  lastBtn = b; digitalWrite(LED, ledOn);
  static uint32_t t = 0; if (millis() - t > 150) { t = millis();
    lcd.setCursor(0, 1); lcd.print("Servo "); lcd.print(angle); lcd.print((char)223); lcd.print("  #"); lcd.print(presses); lcd.print("   ");
    oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE); oled.setTextSize(1); oled.setCursor(0, 0); oled.print("A0 = "); oled.print(raw);
    oled.drawRect(0, 20, 128, 16, SSD1306_WHITE); oled.fillRect(2, 22, map(raw, 0, 1023, 0, 124), 12, SSD1306_WHITE);
    oled.setCursor(0, 48); oled.print(ledOn ? "LED: ON " : "LED: OFF"); oled.display(); }
}
