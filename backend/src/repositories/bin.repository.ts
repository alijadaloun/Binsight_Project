import { RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import { Bin } from '../models/bin.js';

interface BinRow extends RowDataPacket, Omit<Bin, 'computedStatus' | 'readingStale' | 'fallen'> {}

const binsWithLatestReadingQuery = `
  SELECT
    b.bin_id AS binId,
    b.status,
    bc.cluster_id AS clusterId,
    bc.location_name AS locationName,
    bc.latitude AS latitude,
    bc.longitude AS longitude,
    sr.fill_level_percentage AS fillLevelPercentage,
    sr.gas_level AS gasLevel,
    sr.tilt_angle AS tiltAngle,
    sr.timestamp AS lastUpdated
  FROM bins b
  JOIN bin_clusters bc ON b.cluster_id = bc.cluster_id
  LEFT JOIN sensor_readings sr ON sr.id = (
    SELECT sr2.id
    FROM sensor_readings sr2
    WHERE sr2.bin_id = b.bin_id
    ORDER BY sr2.timestamp DESC, sr2.id DESC
    LIMIT 1
  )
`;

export async function findAllBins(): Promise<Omit<Bin, 'computedStatus' | 'readingStale' | 'fallen'>[]> {
  const [rows] = await databasePool.query<BinRow[]>(`${binsWithLatestReadingQuery} ORDER BY b.bin_id`);
  return rows;
}

export async function updateBinStatus(binId: string, status: string): Promise<void> {
  await databasePool.execute('UPDATE bins SET status = ? WHERE bin_id = ?', [status, binId]);
}

export async function findBinById(binId: string): Promise<Omit<Bin, 'computedStatus' | 'readingStale' | 'fallen'> | null> {
  const [rows] = await databasePool.execute<BinRow[]>(
    `${binsWithLatestReadingQuery} WHERE b.bin_id = ?`,
    [binId]
  );
  return rows[0] ?? null;
}
