// The IMU reports the bin's tilt from upright in degrees (about 1-2 when standing normally).
export function isFallen(tiltAngle: number | null, thresholdDegrees: number): boolean {
  return tiltAngle !== null && Math.abs(tiltAngle) >= thresholdDegrees;
}
