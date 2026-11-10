import { HttpError } from '../middleware/http-error.js';
import type { NewSensorReading } from '../models/sensor-reading.js';
import { optionalNumber, requireId, requireTimestamp } from '../controllers/ingestion-validation.js';

export function parseSmsReadings(text: string): NewSensorReading[] {
  if (!text.trim() || text.length > 1600) throw new HttpError(400, 'SMS text must be 1-1600 characters.');

  const lines = text.trim().split(/\r?\n/);
  if (lines.length > 20) throw new HttpError(400, 'SMS contains too many readings.');

  const seen = new Set<string>();
  return lines.map((line) => {
    const fields = line.split(',').map((field) => field.trim());
    if (fields.length !== 5) {
      throw new HttpError(400, 'Each SMS line must be bin_id,fill,gas,tilt,timestamp.');
    }

    const binId = requireId(fields[0], 'bin_id');
    if (seen.has(binId)) throw new HttpError(400, `Duplicate bin_id in SMS: ${binId}.`);
    seen.add(binId);

    const numeric = fields.slice(1, 4).map((value) => value === '' ? NaN : Number(value));
    const fillLevelPercentage = optionalNumber(numeric[0], 'fill_level_percentage', 0, 100);
    const gasLevel = optionalNumber(numeric[1], 'gas_level', 0, 9999.99);
    const tiltAngle = optionalNumber(numeric[2], 'tilt_angle', -999.99, 999.99);
    if (fillLevelPercentage === null || gasLevel === null || tiltAngle === null) {
      throw new HttpError(400, 'Every SMS reading needs fill, gas, and tilt.');
    }

    return {
      binId,
      fillLevelPercentage,
      gasLevel,
      tiltAngle,
      timestamp: requireTimestamp(fields[4])
    };
  });
}
