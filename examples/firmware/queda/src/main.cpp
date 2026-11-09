// Detector de queda em três fases (o padrão dos relógios com detecção de queda):
//  1. queda livre: |a| < 0,4 g por pelo menos 60 ms;
//  2. impacto: |a| > 2,5 g em até 1 s depois;
//  3. imobilidade: 2 s parado (0,8–1,2 g) com o pulso inclinado mais de 50° da posição de antes.
// Confirmada a queda: 10 s de contagem com vibração; o botão cancela, senão o alerta é disparado.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const uint8_t MPU = 0x68, BUTTON = 2, VIBRA = 5, BUZZER = 6, LED = 13;
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
enum State : uint8_t { WATCHING, FREEFALL, IMPACT, COUNTDOWN, ALERT, OK_SHOWN };
State state = WATCHING;
// now = instante do começo do loop; go() usa o mesmo instante, então ms - since nunca fica negativo
// (em unsigned long um negativo vira um número enorme e pula estados: bug achado no simulador).
unsigned long now = 0, since = 0, lastSample = 0, lastDraw = 0, lowSince = 0;
float ax, ay, az, mag, upX = 0, upY = 0, upZ = 1;
uint16_t falls = 0;

bool readAccel() {
  Wire.beginTransmission(MPU); Wire.write(0x3B); if (Wire.endTransmission(false)) return false;
  if (Wire.requestFrom(MPU, (uint8_t)6) != 6) return false;
  int16_t x = (Wire.read() << 8) | Wire.read(), y = (Wire.read() << 8) | Wire.read(), z = (Wire.read() << 8) | Wire.read();
  ax = x / 4096.0; ay = y / 4096.0; az = z / 4096.0; mag = sqrt(ax * ax + ay * ay + az * az); // ±8 g: 4096 LSB/g
  return true;
}
float tiltFromUp() { float d = (ax * upX + ay * upY + az * upZ) / (mag > 0.05 ? mag : 1); if (d > 1) d = 1; if (d < -1) d = -1; return acos(d) * 57.3; }
void go(State s) { state = s; since = now; Serial.print(F("estado: ")); Serial.println((uint8_t)s); }

// Textos em flash (F()) e sem snprintf: com o OLED usando 1 KB dos 2 KB de RAM, a pilha tem pouco espaço.
void screen(const __FlashStringHelper *big, const __FlashStringHelper *small, int8_t n = -1) {
  oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2); oled.setCursor(0, 8); oled.print(big);
  oled.setTextSize(1); oled.setCursor(0, 44); oled.print(small); if (n >= 0) { oled.print(n); oled.print('s'); } oled.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP); pinMode(VIBRA, OUTPUT); pinMode(LED, OUTPUT);
  Wire.begin();
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();     // acorda
  Wire.beginTransmission(MPU); Wire.write(0x1C); Wire.write(0x10); Wire.endTransmission();  // ±8 g
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println(F("OLED nao respondeu"));
  screen(F("Protegido"), F("queda: monitorando"));
  Serial.println(F("pulseira pronta"));
}

void loop() {
  unsigned long ms = now = millis();
  bool pressed = digitalRead(BUTTON) == LOW;
  if (ms - lastSample >= 10 && readAccel()) {
    lastSample = ms;
    switch (state) {
      case WATCHING:
        if (mag > 0.8 && mag < 1.2) { upX = upX * 0.98 + ax / mag * 0.02; upY = upY * 0.98 + ay / mag * 0.02; upZ = upZ * 0.98 + az / mag * 0.02; }
        if (mag < 0.4) { if (!lowSince) lowSince = ms; if (ms - lowSince >= 60) go(FREEFALL); } else lowSince = 0;
        break;
      case FREEFALL:
        if (mag > 2.5) go(IMPACT); else if (ms - since > 1000) { lowSince = 0; go(WATCHING); }
        break;
      case IMPACT:
        if (mag < 0.8 || mag > 1.2) since = ms;                         // ainda mexendo: reinicia os 2 s
        else if (ms - since >= 2000) { if (tiltFromUp() > 50) { falls++; go(COUNTDOWN); Serial.println(F("queda detectada")); } else go(WATCHING); }
        if (state == IMPACT && ms - since > 8000) go(WATCHING);
        break;
      default: break;
    }
  }
  if (state == COUNTDOWN) {
    uint8_t left = 10 - (ms - since) / 1000;
    digitalWrite(VIBRA, ((ms - since) % 1000) < 300);
    if (pressed) { digitalWrite(VIBRA, LOW); go(OK_SHOWN); screen(F("Tudo bem"), F("alerta cancelado")); Serial.println(F("cancelado pelo usuario")); }
    else if (ms - since >= 10000) { digitalWrite(VIBRA, LOW); go(ALERT); Serial.println(F("ALERTA: queda sem resposta, avisando contato")); }
    else if (ms - lastDraw >= 200) { lastDraw = ms; screen(F("QUEDA?"), F("cancelar: botao  "), left); }
  } else if (state == ALERT) {
    digitalWrite(LED, (ms / 250) & 1);
    tone(BUZZER, ((ms / 400) & 1) ? 1800 : 1200);
    if (ms - lastDraw >= 500) { lastDraw = ms; screen(F("ALERTA"), F("contato avisado")); }
    if (pressed) { noTone(BUZZER); digitalWrite(LED, LOW); go(OK_SHOWN); screen(F("Tudo bem"), F("alerta encerrado")); Serial.println(F("alerta encerrado")); }
  } else if (state == OK_SHOWN && ms - since > 3000) { lowSince = 0; go(WATCHING); screen(F("Protegido"), F("queda: monitorando")); }
}
