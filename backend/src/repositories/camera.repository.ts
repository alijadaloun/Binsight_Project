import type { RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import type { Camera } from '../models/camera.js';

interface CameraRow extends RowDataPacket, Camera {}

export async function findAllCameras(): Promise<Camera[]> {
  const [rows] = await databasePool.query<CameraRow[]>(`
    SELECT c.camera_id AS cameraId, c.cluster_id AS clusterId,
           bc.location_name AS locationName, bc.latitude, bc.longitude,
           NULL AS status, MAX(de.timestamp) AS lastEvent
    FROM cameras c
    JOIN bin_clusters bc ON c.cluster_id = bc.cluster_id
    LEFT JOIN detection_events de ON de.camera_id = c.camera_id
    GROUP BY c.camera_id, c.cluster_id, bc.location_name, bc.latitude, bc.longitude
    ORDER BY c.camera_id
  `);
  return rows;
}

export async function cameraExists(cameraId: string): Promise<boolean> {
  const [rows] = await databasePool.execute<RowDataPacket[]>(
    'SELECT 1 FROM cameras WHERE camera_id = ? LIMIT 1', [cameraId]
  );
  return rows.length > 0;
}
