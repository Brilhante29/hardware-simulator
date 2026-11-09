// Relógio inteligente: hora e data do DS3231, passos pelo MPU6050, temperatura, bateria e vibracall.
// Botão (D2, para o GND) troca de tela; o motor (D5) vibra a cada tela, a cada hora cheia e ao bater a meta de passos.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <RTClib.h>

const uint8_t BUTTON = 2, VIBRA = 5, BATTERY = A0, MPU = 0x69;
const uint16_t STEP_GOAL = 10;

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
RTC_DS3231 rtc;
uint8_t screen = 0, lastHour = 255;
uint16_t steps = 0;
bool goalBuzzed = false, wasPressed = false, above = false;
unsigned long vibraUntil = 0, lastStep = 0, lastPress = 0, lastPrint = 0, lastSample = 0;

void vibrate(uint16_t ms) { digitalWrite(VIBRA, HIGH); vibraUntil = millis() + ms; }

bool mpuBegin() {
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); // sai do sono
  return Wire.endTransmission() == 0;
}
// Módulo da aceleração em milésimos de g (±2 g: 16384 LSB/g).
long accelMilliG() {
  Wire.beginTransmission(MPU); Wire.write(0x3B); if (Wire.endTransmission(false) != 0) return -1;
  if (Wire.requestFrom(MPU, (uint8_t)6) != 6) return -1;
  long sum = 0;
  for (uint8_t i = 0; i < 3; i++) { int16_t v = (Wire.read() << 8) | Wire.read(); long mg = (long)v * 1000 / 16384; sum += mg * mg; }
  return (long)sqrt((double)sum);
}

uint8_t batteryPercent() {
  float v = analogRead(BATTERY) * (5.0 / 1023.0) * 2.0; // divisor 1:1
  int p = (int)((v - 3.3) / (4.2 - 3.3) * 100);
  return p < 0 ? 0 : p > 100 ? 100 : p;
}

void drawBattery(uint8_t pct) {
  oled.drawRect(104, 0, 20, 9, SSD1306_WHITE); oled.fillRect(124, 3, 2, 3, SSD1306_WHITE);
  oled.fillRect(106, 2, (uint8_t)(16 * pct / 100), 5, SSD1306_WHITE);
}

void two(uint8_t v) { if (v < 10) oled.print('0'); oled.print(v); }

void draw(const DateTime &now, uint8_t bat) {
  oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE);
  drawBattery(bat);
  oled.setTextSize(1); oled.setCursor(0, 0);
  static const char *const names[] = { "HORA", "PASSOS", "TEMP" };
  oled.print(names[screen]);
  if (screen == 0) {
    oled.setTextSize(3); oled.setCursor(20, 18); two(now.hour()); oled.print(':'); two(now.minute());
    oled.setTextSize(1); oled.setCursor(104, 32); two(now.second());
    oled.setCursor(34, 52); two(now.day()); oled.print('/'); two(now.month()); oled.print('/'); oled.print(now.year());
  } else if (screen == 1) {
    oled.setTextSize(3); oled.setCursor(10, 18); oled.print(steps);
    oled.setTextSize(1); oled.setCursor(10, 44); oled.print(F("meta ")); oled.print(STEP_GOAL);
    oled.drawRect(10, 54, 108, 8, SSD1306_WHITE); oled.fillRect(12, 56, (uint8_t)(104UL * min(steps, STEP_GOAL) / STEP_GOAL), 4, SSD1306_WHITE);
  } else {
    oled.setTextSize(3); oled.setCursor(10, 20); oled.print(rtc.getTemperature(), 1);
    oled.setTextSize(1); oled.print(F(" C"));
  }
  oled.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP); pinMode(VIBRA, OUTPUT);
  Wire.begin();
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println(F("OLED nao respondeu"));
  if (!rtc.begin()) Serial.println(F("RTC nao respondeu"));
  else if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  if (!mpuBegin()) Serial.println(F("MPU6050 nao respondeu em 0x69"));
  Serial.println(F("relogio pronto"));
  vibrate(150);
}

void loop() {
  unsigned long ms = millis();
  if (vibraUntil && ms >= vibraUntil) { digitalWrite(VIBRA, LOW); vibraUntil = 0; }

  // Botão com debounce de 30 ms: cada aperto avança a tela.
  bool pressed = digitalRead(BUTTON) == LOW;
  if (pressed != wasPressed && ms - lastPress > 30) { lastPress = ms; wasPressed = pressed; if (pressed) { screen = (screen + 1) % 3; vibrate(60); } }

  // Passo: o módulo da aceleração passa de 1,3 g e volta abaixo de 1,1 g, com no mínimo 250 ms entre passos.
  if (ms - lastSample >= 20) {
    lastSample = ms; long a = accelMilliG();
    if (a > 1300 && !above && ms - lastStep > 250) { above = true; steps++; lastStep = ms; }
    else if (a >= 0 && a < 1100) above = false;
    if (steps >= STEP_GOAL && !goalBuzzed) { goalBuzzed = true; vibrate(400); Serial.println(F("meta de passos!")); }
  }

  if (ms - lastPrint >= 1000) {
    lastPrint = ms;
    DateTime now = rtc.now(); uint8_t bat = batteryPercent();
    if (lastHour != 255 && now.hour() != lastHour) vibrate(300);
    lastHour = now.hour();
    draw(now, bat);
    char line[48]; snprintf(line, sizeof line, "%02u:%02u:%02u passos=%u bat=%u%% tela=%u", now.hour(), now.minute(), now.second(), steps, bat, screen);
    Serial.println(line);
  }
}
