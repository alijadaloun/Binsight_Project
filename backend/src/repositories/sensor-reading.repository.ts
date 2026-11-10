import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import type { NewSensorReading, SensorReading, SensorReadingFilters } from '../models/sensor-reading.js';

interface SensorReadingRow extends RowDataPacket, SensorReading {}

const selectReading = `
  SELECT id, bin_id AS binId, fill_level_percentage AS fillLevelPercentage,
         gas_level AS gasLevel, tilt_angle AS tiltAngle, timestamp
  FROM sensor_readings
`;

export async function findSensorReadings(filters: SensorReadingFilters): Promise<SensorReading[]> {
  const conditions: string[] = [];
  const parameters: (string | Date)[] = [];

  if (filters.binId) {
    conditions.push('bin_id = ?');
    parameters.push(filters.binId);
  }
  if (filters.from) {
    conditions.push('timestamp >= ?');
    parameters.push(filters.from);
  }
  if (filters.to) {
    conditions.push('timestamp <= ?');
    parameters.push(filters.to);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await databasePool.execute<SensorReadingRow[]>(
    `${selectReading}${where} ORDER BY timestamp DESC, id DESC`,
    parameters
  );
  return rows;
}

export async function findBinReadings(binId: string): Promise<SensorReading[]> {
  const [rows] = await databasePool.execute<SensorReadingRow[]>(
    `${selectReading} WHERE bin_id = ? ORDER BY timestamp ASC, id ASC`,
    [binId]
  );
  return rows;
}

export async function hasSensorReadingAt(binId: string, timestamp: Date): Promise<boolean> {
  const [rows] = await databasePool.execute<RowDataPacket[]>(
    'SELECT id FROM sensor_readings WHERE bin_id = ? AND timestamp = ? LIMIT 1',
    [binId, timestamp]
  );
  return rows.length > 0;
}

export async function createSensorReading(reading: NewSensorReading): Promise<SensorReading> {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `INSERT INTO sensor_readings
       (bin_id, fill_level_percentage, gas_level, tilt_angle, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [reading.binId, reading.fillLevelPercentage, reading.gasLevel, reading.tiltAngle, reading.timestamp]
  );
  const [rows] = await databasePool.execute<SensorReadingRow[]>(
    `${selectReading} WHERE id = ?`, [result.insertId]
  );
  if (!rows[0]) throw new Error('Created sensor reading could not be found.');
  return rows[0];
}
