// Bengala inteligente para pessoas cegas ou com baixa visão: avisa obstáculos à frente (até 2 m) por vibração
// proporcional e bipes, sem depender da tela. A distância usa a velocidade do som a 20 °C e mediana de 3 leituras.
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const uint8_t TRIG = 9, ECHO = 10, VIBRA = 5, BUZZER = 6, BUTTON = 2;
const uint16_t RANGE_CM = 200;
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
bool sound = true, wasPressed = false;
unsigned long lastBeep = 0, lastPress = 0, lastPrint = 0;
uint16_t cm = 0;

uint16_t ping() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2); digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000UL);           // 30 ms ≈ 5 m: sem eco = nada à frente
  return us ? us / 58 : 999;
}
uint16_t median3() { uint16_t a = ping(); delay(15); uint16_t b = ping(); delay(15); uint16_t c = ping();
  if (a > b) { uint16_t t = a; a = b; b = t; } if (b > c) { uint16_t t = b; b = c; c = t; } if (a > b) { uint16_t t = a; a = b; b = t; } return b; }

void draw() {
  oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1); oled.setCursor(0, 0); oled.print(sound ? F("VIBRA + SOM") : F("SO VIBRA"));
  oled.setTextSize(3); oled.setCursor(0, 18); if (cm >= 999) oled.print(F("livre")); else { oled.print(cm); oled.print(F("cm")); }
  uint8_t w = cm >= RANGE_CM ? 0 : (uint8_t)(128UL * (RANGE_CM - cm) / RANGE_CM);
  oled.fillRect(0, 54, w, 10, SSD1306_WHITE); oled.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(VIBRA, OUTPUT); pinMode(BUTTON, INPUT_PULLUP);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println(F("OLED nao respondeu"));
  Serial.println(F("bengala pronta"));
}

void loop() {
  unsigned long ms = millis();
  bool pressed = digitalRead(BUTTON) == LOW;
  if (pressed != wasPressed && ms - lastPress > 40) { lastPress = ms; wasPressed = pressed; if (pressed) { sound = !sound; noTone(BUZZER); } }
  cm = median3();
  // Vibração: 0 a partir de 2 m, sobe até o máximo a 20 cm (o motor só começa a girar perto de 25 % do PWM).
  uint8_t duty = cm >= RANGE_CM ? 0 : cm <= 20 ? 255 : (uint8_t)(64 + 191UL * (RANGE_CM - cm) / (RANGE_CM - 20));
  analogWrite(VIBRA, duty);
  // Bipes: intervalo de 1 s a 2 m até tom contínuo abaixo de 30 cm.
  if (sound && cm < RANGE_CM) {
    if (cm < 30) tone(BUZZER, 2000);
    else { unsigned long gap = 80 + (unsigned long)(cm - 30) * 920 / (RANGE_CM - 30); if (ms - lastBeep >= gap) { lastBeep = ms; tone(BUZZER, 2000, 40); } }
  } else noTone(BUZZER);
  draw();
  if (ms - lastPrint >= 500) { lastPrint = ms; Serial.print(F("dist=")); Serial.print(cm); Serial.print(F(" vib=")); Serial.print(duty); Serial.println(sound ? F(" som") : F(" mudo")); }
}
