// Triagem de FA pelo PPG do pulso, no próprio chip (edge no dispositivo):
//  - cada batimento vira um intervalo RR, contado em amostras do sensor (100/s);
//  - batimento com o pulso em movimento é descartado (o acelerômetro mede a qualidade do sinal);
//  - a cada 2 s, com pelo menos 24 intervalos: irregularidade = mediana das diferenças sucessivas / mediana dos RR.
//    FA tem intervalos irregularmente irregulares; o ritmo sinusal varia poucos % de um batimento para o outro.
//    É a ideia do nRMSSD (Dash et al., 2009), com medianas: um batimento detectado errado não dispara alarme
//    (com RMSSD, um único RR de 510 ms entre 30 de ~850 ms dava 0,116 e um falso alerta);
//  - 3 janelas seguidas acima do limiar = suspeita de FA: vibra, mostra na tela e marca na telemetria.
// SpO2 pela razão R = (AC/DC vermelho)/(AC/DC infravermelho), SpO2 ≈ 110 − 25·R.
#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_GC9A01A.h>
#include <MAX30105.h>
#include <heartRate.h>

const uint8_t TFT_CS = 10, TFT_DC = 9, TFT_RST = 8, VIBRA = 5, BUTTON = 2, MPU = 0x68, N = 32;
Adafruit_GC9A01A tft(TFT_CS, TFT_DC, TFT_RST);
MAX30105 ppg;
uint16_t rr[N]; uint8_t rrCount = 0, rrHead = 0, afWindows = 0;
unsigned long sampleNo = 0, lastBeatSample = 0, lastAccel = 0, lastReport = 0, vibraUntil = 0;
uint32_t redMax = 0, redMin = 0xFFFFFFFF, irMax = 0, irMin = 0xFFFFFFFF;
float dcRed = 0, dcIr = 0, spo2 = 0, motion = 0, magAvg = 1, irr = 0;
uint16_t accepted = 0, rejected = 0; uint8_t hr = 0; bool af = false, moving = false, ppgOk = false, wasPressed = false;
int8_t shownState = -1;

void vibrate(uint16_t ms) { digitalWrite(VIBRA, HIGH); vibraUntil = millis() + ms; }
float accelMag() {
  Wire.beginTransmission(MPU); Wire.write(0x3B); if (Wire.endTransmission(false)) return 1;
  if (Wire.requestFrom(MPU, (uint8_t)6) != 6) return 1;
  float s = 0; for (uint8_t i = 0; i < 3; i++) { int16_t v = (Wire.read() << 8) | Wire.read(); float g = v / 16384.0; s += g * g; }
  return sqrt(s);
}
void addRR(uint16_t ms) { rr[rrHead] = ms; rrHead = (rrHead + 1) % N; if (rrCount < N) rrCount++; }
// Mediana de até 31 valores (ordenação por inserção, 62 bytes na pilha).
uint16_t median(uint16_t *v, uint8_t n) { for (uint8_t i = 1; i < n; i++) { uint16_t x = v[i]; int8_t j = i - 1; while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; } v[j + 1] = x; } return v[n / 2]; }
void analyse() {
  if (rrCount < 24) { irr = 0; return; }
  uint16_t a[N], d[N]; uint8_t start = (rrHead + N - rrCount) % N;
  for (uint8_t i = 0; i < rrCount; i++) a[i] = rr[(start + i) % N];
  for (uint8_t i = 1; i < rrCount; i++) { int16_t x = (int16_t)a[i] - (int16_t)a[i - 1]; d[i - 1] = x < 0 ? -x : x; }
  uint16_t mdiff = median(d, rrCount - 1), mrr = median(a, rrCount);
  irr = (float)mdiff / mrr; hr = 60000UL / mrr;
  afWindows = irr > 0.08 ? (afWindows < 255 ? afWindows + 1 : 255) : 0;
  bool now = afWindows >= 3;
  if (now && !af) { vibrate(800); Serial.println(F("{\"evt\":\"af_suspeita\"}")); }
  af = now;
}
void draw() {
  int8_t st = !ppgOk ? 0 : moving ? 1 : af ? 3 : 2;
  if (st != shownState) {
    shownState = st; tft.fillCircle(120, 120, 104, GC9A01A_BLACK);
    uint16_t c = st == 3 ? 0xF800 : st == 2 ? 0x07E0 : 0xFD20;
    for (uint8_t r = 112; r < 118; r++) tft.drawCircle(120, 120, r, c);
    // Textos curtos centrados: a 60 px do topo a tela redonda só tem ~190 px de largura útil.
    const __FlashStringHelper *msg = st == 3 ? F("IRREGULAR") : st == 2 ? F("regular") : st == 1 ? F("parado p/ medir") : F("sem sensor");
    uint8_t len = st == 3 ? 9 : st == 2 ? 7 : st == 1 ? 15 : 10;
    tft.setTextSize(2); tft.setTextColor(c, GC9A01A_BLACK); tft.setCursor(120 - len * 6, 60); tft.print(msg);
  }
  tft.setTextColor(GC9A01A_WHITE, GC9A01A_BLACK); tft.setTextSize(6); tft.setCursor(66, 86);
  if (hr) { if (hr < 100) tft.print(' '); tft.print(hr); } else tft.print(F("--"));
  tft.setTextSize(2); tft.setCursor(80, 146); tft.print(F("SpO2 ")); if (spo2 > 50) { tft.print((int)spo2); tft.print('%'); } else tft.print(F("--  "));
  tft.setTextSize(1); tft.setCursor(76, 176); tft.print(F("irreg. ")); tft.print(irr, 3);
}

void setup() {
  Serial.begin(115200);
  pinMode(VIBRA, OUTPUT); pinMode(BUTTON, INPUT_PULLUP);
  tft.begin(); tft.fillScreen(GC9A01A_BLACK);
  Wire.begin(); Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
  ppgOk = ppg.begin(Wire, I2C_SPEED_FAST);
  if (ppgOk) ppg.setup(0x1F, 4, 2, 400, 411, 4096); else Serial.println(F("{\"erro\":\"MAX30102\"}"));
  Serial.println(F("{\"evt\":\"pronta\",\"dispositivo\":\"HS-Pulse\"}"));
}

void loop() {
  unsigned long ms = millis();
  if (vibraUntil && ms >= vibraUntil) { digitalWrite(VIBRA, LOW); vibraUntil = 0; }
  bool pressed = digitalRead(BUTTON) == LOW;
  if (pressed && !wasPressed) Serial.println(F("{\"evt\":\"sos\"}"));
  wasPressed = pressed;
  if (ms - lastAccel >= 20) { lastAccel = ms; float m = accelMag(); magAvg += (m - magAvg) * 0.1; motion += (fabs(m - magAvg) - motion) * 0.1; moving = motion > 0.05; }
  if (ppgOk) {
    ppg.check();
    while (ppg.available()) {
      uint32_t ir = ppg.getFIFOIR(), red = ppg.getFIFORed(); sampleNo++;
      dcIr += ((float)ir - dcIr) * 0.02; dcRed += ((float)red - dcRed) * 0.02;
      if (ir > irMax) irMax = ir; if (ir < irMin) irMin = ir; if (red > redMax) redMax = red; if (red < redMin) redMin = red;
      if (ir > 50000 && checkForBeat(ir)) {
        uint16_t dt = (sampleNo - lastBeatSample) * 10; lastBeatSample = sampleNo;
#ifdef DEBUG_RR
        Serial.print(F("rr ")); Serial.println(dt);
#endif
        if (!moving && dt > 300 && dt < 2000) {
          addRR(dt); accepted++;
          Serial.print(F("{\"b\":")); Serial.print(dt); Serial.println('}');   // cada RR aceito vai para o edge (Poincaré)
          float R = ((float)(redMax - redMin) / dcRed) / ((float)(irMax - irMin) / dcIr), s = 110 - 25 * R;
          if (s > 70 && s <= 100) spo2 = spo2 ? spo2 + (s - spo2) * 0.2 : s;
        } else rejected++;
        redMax = irMax = 0; redMin = irMin = 0xFFFFFFFF;
      }
      if (ir < 50000) { rrCount = 0; hr = 0; afWindows = 0; af = false; }
      ppg.nextSample();
    }
  }
  if (ms - lastReport >= 2000) {
    lastReport = ms; analyse(); draw();
    uint8_t q = accepted + rejected ? (uint8_t)(100UL * accepted / (accepted + rejected)) : 0; accepted = rejected = 0;
    Serial.print(F("{\"t\":")); Serial.print(ms / 1000); Serial.print(F(",\"hr\":")); Serial.print(hr); Serial.print(F(",\"spo2\":")); Serial.print((int)spo2);
    Serial.print(F(",\"irr\":")); Serial.print(irr, 3); Serial.print(F(",\"rr\":")); Serial.print(rrCount); Serial.print(F(",\"q\":")); Serial.print(q);
    Serial.print(F(",\"mov\":")); Serial.print(moving ? 1 : 0); Serial.print(F(",\"af\":")); Serial.print(af ? 1 : 0); Serial.println('}');
  }
}
