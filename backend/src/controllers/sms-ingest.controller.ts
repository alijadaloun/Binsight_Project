import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import { requireObject } from './ingestion-validation.js';
import { HttpError } from '../middleware/http-error.js';
import { parseSmsReadings } from '../services/sms-parser.js';
import { storedBinStatus } from '../services/thresholds.js';

interface BinClusterRow extends RowDataPacket { binId: string; clusterId: string }

export async function postSms(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const expectedSender = process.env.SMS_SENDER_NUMBER?.trim();
    const expectedCluster = process.env.SMS_CLUSTER_ID?.trim();
    if (!expectedSender || !expectedCluster) {
      throw new HttpError(503, 'SMS ingestion is disabled until sender and cluster are configured.');
    }

    const body = requireObject(request.body);
    const sender = body.sender;
    const smsText = body.text;
    if (typeof sender !== 'string' || sender.trim() !== expectedSender) {
      throw new HttpError(403, 'SMS sender is not registered.');
    }
    if (typeof smsText !== 'string') throw new HttpError(400, 'text must be a string.');
    const readings = parseSmsReadings(smsText);
    const hash = createHash('sha256').update(sender.trim()).update('\0').update(smsText.trim()).digest('hex');

    const connection = await databasePool.getConnection();
    try {
      await connection.beginTransaction();
      const [bins] = await connection.query<BinClusterRow[]>(
        'SELECT bin_id AS binId, cluster_id AS clusterId FROM bins WHERE bin_id IN (?)',
        [readings.map((reading) => reading.binId)]
      );
      if (bins.length !== readings.length || bins.some((bin) => bin.clusterId !== expectedCluster)) {
        throw new HttpError(400, 'SMS contains an unknown bin or a bin outside the sender cluster.');
      }

      const [receipt] = await connection.execute<ResultSetHeader>(
        'INSERT INTO sms_ingest_receipts (message_hash, sender_number, cluster_id) VALUES (?, ?, ?)',
        [hash, sender.trim(), expectedCluster]
      );
      for (const reading of readings) {
        await connection.execute(
          `INSERT INTO sensor_readings
           (bin_id, fill_level_percentage, gas_level, tilt_angle, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [reading.binId, reading.fillLevelPercentage, reading.gasLevel, reading.tiltAngle, reading.timestamp]
        );
        if (reading.fillLevelPercentage !== null && reading.tiltAngle !== null) {
          await connection.execute(
            'UPDATE bins SET status = ? WHERE bin_id = ?',
            [storedBinStatus(reading.fillLevelPercentage, reading.tiltAngle), reading.binId]
          );
        }
      }
      await connection.commit();
      response.status(201).json({ receiptId: receipt.insertId, clusterId: expectedCluster, readingsCreated: readings.length });
    } catch (error) {
      await connection.rollback();
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        response.status(200).json({ duplicate: true, readingsCreated: 0 });
        return;
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}
