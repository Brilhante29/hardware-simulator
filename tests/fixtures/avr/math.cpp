#include <Arduino.h>
uint32_t crc32(const uint8_t *d, size_t n){ uint32_t c = 0xFFFFFFFF; for (size_t i=0;i<n;i++){ c ^= d[i]; for (int k=0;k<8;k++) c = (c>>1) ^ (0xEDB88320 & -(c & 1)); } return ~c; }
void setup(){
  Serial.begin(115200);
  long a = 123456789L; long b = -98765L;
  Serial.println(a / b); Serial.println(a % b); Serial.println(a * 3L);
  float x = 3.14159f; Serial.println(sqrt(2.0), 6); Serial.println(sin(x/6), 5); Serial.println(x * 1000.0f, 2);
  uint8_t buf[] = "hardware studio"; Serial.println(crc32(buf, 15), HEX);
  uint16_t f = 1; for (int i=2;i<=8;i++) f *= i; Serial.println(f);
  String s = String("Uno") + 328 + 'P'; Serial.println(s);
  int8_t n = -7; Serial.println(n >> 1); Serial.println((unsigned)(n & 0xFF));
  Serial.println(1000000UL / 7);
  Serial.println("fim");
}
void loop(){}
