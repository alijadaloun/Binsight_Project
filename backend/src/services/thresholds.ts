import type { ComputedBinStatus } from '../models/bin.js';

function readBounded(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number from ${min} to ${max}.`);
  }
  return value;
}

// A bin at or above this fill percentage is full and needs collection.
export const fullFillPercentage = readBounded('FULL_FILL_PERCENTAGE', 70, 1, 100);

// Tilt from upright, in degrees, at which the bin is stored and shown as fallen.
export const fallenTiltDegrees = readBounded('FALLEN_TILT_DEGREES', 45, 1, 180);

export type StoredBinStatus = 'NORMAL' | 'FULL' | 'FALLEN';

export function calculateStatus(fillLevelPercentage: number | null): ComputedBinStatus | null {
  if (fillLevelPercentage === null) return null;
  if (fillLevelPercentage < fullFillPercentage) return 'NORMAL';
  if (fillLevelPercentage < 85) return 'WARNING';
  if (fillLevelPercentage < 95) return 'NEEDS_COLLECTION';
  return 'CRITICAL';
}

export function storedBinStatus(fillLevelPercentage: number, tiltAngle: number): StoredBinStatus {
  if (Math.abs(tiltAngle) >= fallenTiltDegrees) return 'FALLEN';
  if (fillLevelPercentage >= fullFillPercentage) return 'FULL';
  return 'NORMAL';
}
