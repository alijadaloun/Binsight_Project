import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../middleware/http-error.js';
import type { NewSensorReading, SensorReadingFilters } from '../models/sensor-reading.js';
import { findBinById, updateBinStatus } from '../repositories/bin.repository.js';
import { createSensorReading, findSensorReadings } from '../repositories/sensor-reading.repository.js';
import { storedBinStatus } from '../services/thresholds.js';
import { optionalNumber, requireId, requireObject, requireTimestamp } from './ingestion-validation.js';

function parseDate(value: unknown, name: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    throw new HttpError(400, `${name} must be an ISO date or datetime.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${name} must be a valid date.`);
  return date;
}

export async function listSensorReadings(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const binId = request.query.bin_id;
    if (binId !== undefined && (typeof binId !== 'string' || !binId.trim())) {
      throw new HttpError(400, 'bin_id must be a nonempty string.');
    }

    const filters: SensorReadingFilters = {
      binId: binId as string | undefined,
      from: parseDate(request.query.from, 'from'),
      to: parseDate(request.query.to, 'to')
    };
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new HttpError(400, 'from must be before or equal to to.');
    }
    response.json(await findSensorReadings(filters));
  } catch (error) {
    next(error);
  }
}

export async function postSensorReading(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const body = requireObject(request.body);
    const reading: NewSensorReading = {
      binId: requireId(body.bin_id, 'bin_id'),
      fillLevelPercentage: optionalNumber(body.fill_level_percentage, 'fill_level_percentage', 0, 100),
      gasLevel: optionalNumber(body.gas_level, 'gas_level', 0, 9999.99),
      tiltAngle: optionalNumber(body.tilt_angle, 'tilt_angle', -999.99, 999.99),
      timestamp: requireTimestamp(body.timestamp)
    };
    if (reading.fillLevelPercentage === null || reading.gasLevel === null || reading.tiltAngle === null) {
      throw new HttpError(400, 'fill_level_percentage, gas_level, and tilt_angle are all required.');
    }
    if (!await findBinById(reading.binId)) throw new HttpError(404, 'Bin not found.');
    const created = await createSensorReading(reading);
    await updateBinStatus(
      reading.binId,
      storedBinStatus(reading.fillLevelPercentage, reading.tiltAngle)
    );
    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
}
