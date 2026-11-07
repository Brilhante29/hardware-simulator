#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
Adafruit_MPU6050 mpu;
void setup(){ Serial.begin(115200); if (!mpu.begin()) { Serial.println("sem mpu"); return; } mpu.setAccelerometerRange(MPU6050_RANGE_4_G); mpu.setGyroRange(MPU6050_RANGE_500_DEG); }
void loop(){ sensors_event_t a, g, t; mpu.getEvent(&a, &g, &t);
  Serial.print(a.acceleration.x, 2); Serial.print(' '); Serial.print(a.acceleration.y, 2); Serial.print(' '); Serial.print(a.acceleration.z, 2); Serial.print(' ');
  Serial.print(g.gyro.z, 3); Serial.print(' '); Serial.println(t.temperature, 1); delay(300); }
