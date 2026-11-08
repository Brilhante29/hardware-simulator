#include <Arduino.h>
// Quatro USARTs: cada uma diz quem é; Serial1 ecoa em maiúsculas pela Serial0.
void setup() {
  Serial.begin(115200); Serial1.begin(9600); Serial2.begin(57600); Serial3.begin(19200);
  pinMode(13, OUTPUT);
  Serial.println("mega0"); Serial1.println("um"); Serial2.println("dois"); Serial3.println("tres");
  Serial.print("RAM livre ok: "); Serial.println(RAMEND, HEX);
}
unsigned long last = 0; bool led = false;
void loop() {
  while (Serial1.available()) { char c = Serial1.read(); Serial.write(toupper(c)); }
  if (millis() - last >= 500) { last += 500; led = !led; digitalWrite(13, led); }
}
