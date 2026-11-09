// Conforto térmico pelo índice de calor (fórmula de Rothfusz, NWS) e iluminação pela NBR ISO/CIE 8995-1
// (500 lx para escritório e sala de aula). Verde = confortável, amarelo = atenção, vermelho = fora da faixa.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_SSD1306.h>

const uint8_t PIX = 6, BUZZER = 3;
Adafruit_BME280 bme; BH1750 light; Adafruit_NeoPixel bar(8, PIX, NEO_GRB + NEO_KHZ800); Adafruit_SSD1306 oled(128, 64, &Wire, -1);

float heatIndexC(float t, float rh) {
  float f = t * 1.8 + 32, hi = 0.5 * (f + 61.0 + (f - 68.0) * 1.2 + rh * 0.094);
  if (hi >= 80) hi = -42.379 + 2.04901523 * f + 10.14333127 * rh - 0.22475541 * f * rh - 0.00683783 * f * f - 0.05481717 * rh * rh + 0.00122874 * f * f * rh + 0.00085282 * f * rh * rh - 0.00000199 * f * f * rh * rh;
  return (hi - 32) / 1.8;
}
uint32_t level(uint8_t k) { return k == 0 ? bar.Color(0, 160, 40) : k == 1 ? bar.Color(200, 140, 0) : bar.Color(220, 0, 0); }

void setup() {
  Serial.begin(115200); Wire.begin(); bar.begin(); bar.setBrightness(60);
  if (!bme.begin(0x76)) Serial.println(F("BME280 nao respondeu"));
  if (!light.begin()) Serial.println(F("BH1750 nao respondeu"));
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println(F("OLED nao respondeu"));
  Serial.println(F("estacao pronta"));
}

void loop() {
  float t = bme.readTemperature(), rh = bme.readHumidity(), hpa = bme.readPressure() / 100.0, lux = light.readLightLevel(), hi = heatIndexC(t, rh);
  uint8_t thermal = (hi >= 20 && hi <= 26 && rh >= 40 && rh <= 65) ? 0 : (hi > 32 || hi < 16 || rh < 25 || rh > 80) ? 2 : 1;
  uint8_t lit = lux >= 400 && lux <= 1000 ? 0 : lux >= 200 && lux <= 2000 ? 1 : 2;
  for (uint8_t i = 0; i < 4; i++) { bar.setPixelColor(i, level(thermal)); bar.setPixelColor(4 + i, level(lit)); }
  bar.show();
  if (hi >= 41) tone(BUZZER, 2500, 150); else noTone(BUZZER);
  oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE); oled.setTextSize(2); oled.setCursor(0, 0); oled.print(t, 1); oled.print(F("C "));
  oled.print((int)rh); oled.print('%'); oled.setTextSize(1); oled.setCursor(0, 22); oled.print(F("sensacao ")); oled.print(hi, 1); oled.print(F(" C"));
  oled.setCursor(0, 36); oled.print((int)lux); oled.print(F(" lx  ")); oled.print((int)hpa); oled.print(F(" hPa"));
  oled.setCursor(0, 52); oled.print(thermal == 0 && lit == 0 ? F("ambiente confortavel") : thermal == 2 ? F("calor/umidade: atencao") : lit == 2 ? F("luz inadequada") : F("quase ideal"));
  oled.display();
  Serial.print(F("t=")); Serial.print(t, 1); Serial.print(F(" rh=")); Serial.print(rh, 0); Serial.print(F(" hi=")); Serial.print(hi, 1); Serial.print(F(" lux=")); Serial.print(lux, 0); Serial.print(F(" termico=")); Serial.print(thermal); Serial.print(F(" luz=")); Serial.println(lit);
  delay(1000);
}
