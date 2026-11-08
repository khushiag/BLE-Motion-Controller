#ifndef ACCEL_H
#define ACCEL_H

#include <stdbool.h>

/* Sets up I2C and the accelerometer. Returns true if the sensor was found. */
bool Accel_Init(void);

/* Reads the sensor once and calculates tilt angles in degrees. */
bool Accel_ReadTilt(float *pRoll, float *pPitch);

#endif /* ACCEL_H */