#include <Arduino.h>
// USART0 em modo SPI mestre (MSPIM): transfere 2 bytes e imprime a resposta pela... SPI de verdade? Não: guarda e pisca.
volatile byte r1, r2;
void setup(){ UBRR0 = 0; DDRD |= _BV(4); UCSR0C = _BV(UMSEL01) | _BV(UMSEL00); UCSR0B = _BV(RXEN0) | _BV(TXEN0); UBRR0 = 7;
  while (!(UCSR0A & _BV(UDRE0))); UDR0 = 0x5A; while (!(UCSR0A & _BV(RXC0))); r1 = UDR0;
  while (!(UCSR0A & _BV(UDRE0))); UDR0 = 0xC3; while (!(UCSR0A & _BV(RXC0))); r2 = UDR0;
  UCSR0B = 0; UCSR0C = 0x06; Serial.begin(115200); Serial.print(r1, HEX); Serial.print(' '); Serial.println(r2, HEX); }
void loop(){}
