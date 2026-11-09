// Relógio inteligente com tela redonda: hora grande, data, anel de passos, batimento (MAX30102) e bateria.
// Só redesenha o que mudou (como um relógio real faz para economizar SPI e bateria).
#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_GC9A01A.h>
#include <RTClib.h>
#include <MAX30105.h>
#include <heartRate.h>

const uint8_t TFT_CS = 10, TFT_DC = 9, TFT_RST = 8, BUTTON = 2, VIBRA = 5, MPU = 0x69;
const uint16_t STEP_GOAL = 100;
Adafruit_GC9A01A tft(TFT_CS, TFT_DC, TFT_RST);
RTC_DS3231 rtc;
MAX30105 ppg;

uint16_t steps = 0, shownSteps = 0xffff; uint8_t bpm = 0, shownBpm = 0xff, shownMin = 0xff, shownBat = 0xff;
// Tempo do batimento contado em amostras do sensor (100/s), não em millis(): a FIFO chega em rajadas depois de cada
// redesenho da tela, e medir na hora da leitura somaria esse atraso ao intervalo.
unsigned long sampleNo = 0, lastBeatSample = 0; uint8_t rates[4], rateIdx = 0; bool above = false, ppgOk = false;
unsigned long lastStep = 0, lastSample = 0, lastTick = 0, vibraUntil = 0;

void vibrate(uint16_t ms) { digitalWrite(VIBRA, HIGH); vibraUntil = millis() + ms; }
long accelMilliG() {
  Wire.beginTransmission(MPU); Wire.write(0x3B); if (Wire.endTransmission(false)) return -1;
  if (Wire.requestFrom(MPU, (uint8_t)6) != 6) return -1;
  long sum = 0; for (uint8_t i = 0; i < 3; i++) { int16_t v = (Wire.read() << 8) | Wire.read(); long mg = (long)v * 1000 / 16384; sum += mg * mg; }
  return (long)sqrt((double)sum);
}
uint8_t batteryPercent() { float v = analogRead(A0) * (5.0 / 1023.0) * 2.0; int p = (int)((v - 3.3) / 0.9 * 100); return p < 0 ? 0 : p > 100 ? 100 : p; }

// Anel de progresso dos passos: 60 tiques em volta da tela.
void drawRing() {
  uint8_t lit = (uint32_t)min(steps, STEP_GOAL) * 60 / STEP_GOAL;
  for (uint8_t i = 0; i < 60; i++) {
    float a = (i * 6 - 90) * DEG_TO_RAD; int x0 = 120 + cos(a) * 108, y0 = 120 + sin(a) * 108, x1 = 120 + cos(a) * 117, y1 = 120 + sin(a) * 117;
    tft.drawLine(x0, y0, x1, y1, i < lit ? 0x07E0 : 0x2124);
  }
}
void two(uint8_t v) { if (v < 10) tft.print('0'); tft.print(v); }

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP); pinMode(VIBRA, OUTPUT);
  tft.begin(); tft.fillScreen(GC9A01A_BLACK);
  Wire.begin();
  if (!rtc.begin()) Serial.println(F("RTC nao respondeu")); else if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
  ppgOk = ppg.begin(Wire, I2C_SPEED_FAST);
  if (ppgOk) { ppg.setup(0x1F, 4, 2, 400, 411, 4096); } else Serial.println(F("MAX30102 nao respondeu"));
  tft.setTextColor(0xFD20, GC9A01A_BLACK); tft.setTextSize(2); tft.setCursor(96, 196); tft.print(F("HS-1"));
  drawRing();
  Serial.println(F("relogio cor pronto"));
}

void loop() {
  unsigned long ms = millis();
  if (vibraUntil && ms >= vibraUntil) { digitalWrite(VIBRA, LOW); vibraUntil = 0; }

  if (ppgOk) {
    ppg.check();
    while (ppg.available()) {
      long ir = ppg.getFIFOIR();
      sampleNo++;
      if (ir > 50000 && checkForBeat(ir)) {
        long dt = (sampleNo - lastBeatSample) * 10; lastBeatSample = sampleNo;
        if (dt > 300 && dt < 2000) { rates[rateIdx++ & 3] = 60000L / dt; uint16_t s = 0; for (uint8_t i = 0; i < 4; i++) s += rates[i]; bpm = s / 4; }
      }
      if (ir < 50000) bpm = 0;
      ppg.nextSample();
    }
  }

  if (ms - lastSample >= 20) {
    lastSample = ms; long a = accelMilliG();
    if (a > 1300 && !above && ms - lastStep > 250) { above = true; steps++; lastStep = ms; if (steps == STEP_GOAL) vibrate(400); }
    else if (a >= 0 && a < 1100) above = false;
  }

  if (ms - lastTick >= 250) {
    lastTick = ms; DateTime now = rtc.now();
    if (now.minute() != shownMin) {
      shownMin = now.minute();
      tft.setTextColor(GC9A01A_WHITE, GC9A01A_BLACK); tft.setTextSize(6); tft.setCursor(30, 72); two(now.hour()); tft.print(':'); two(now.minute());
      tft.setTextSize(2); tft.setTextColor(0x8410, GC9A01A_BLACK); tft.setCursor(66, 128); two(now.day()); tft.print('/'); two(now.month()); tft.print('/'); tft.print(now.year());
    }
    if (bpm != shownBpm) { shownBpm = bpm; tft.fillRect(60, 152, 120, 20, GC9A01A_BLACK); tft.setTextSize(2); tft.setTextColor(0xF800); tft.setCursor(62, 154); tft.print((char)3); tft.setTextColor(GC9A01A_WHITE); tft.print(' '); if (bpm) tft.print(bpm); else tft.print(F("--")); tft.print(F(" bpm")); }
    if (steps != shownSteps) { shownSteps = steps; tft.fillRect(80, 40, 90, 20, GC9A01A_BLACK); tft.setTextSize(2); tft.setTextColor(0x07E0); tft.setCursor(82, 42); tft.print(steps); tft.print(F(" p")); drawRing(); }
    uint8_t bat = batteryPercent();
    if (bat != shownBat) { shownBat = bat; tft.fillRect(100, 176, 50, 16, GC9A01A_BLACK); tft.setTextSize(1); tft.setTextColor(bat < 20 ? 0xF800 : 0xC618); tft.setCursor(104, 180); tft.print(bat); tft.print('%'); }
  }
  static unsigned long lastPrint = 0;
  if (ms - lastPrint >= 1000) { lastPrint = ms; DateTime now = rtc.now(); char line[56]; snprintf(line, sizeof line, "%02u:%02u:%02u bpm=%u passos=%u", now.hour(), now.minute(), now.second(), bpm, steps); Serial.println(line); }
}
