import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import type { DetectionEvent, NewDetectionEvent } from '../models/detection-event.js';

interface DetectionEventRow extends RowDataPacket, DetectionEvent {}

const selectEvent = `
  SELECT de.event_id AS eventId, de.event_type AS eventType,
         de.confidence, de.timestamp, de.snapshot,
         c.camera_id AS cameraId, bc.cluster_id AS clusterId,
         bc.location_name AS locationName, bc.latitude, bc.longitude
  FROM detection_events de
  JOIN cameras c ON de.camera_id = c.camera_id
  JOIN bin_clusters bc ON c.cluster_id = bc.cluster_id
`;

export async function findAllDetectionEvents(): Promise<DetectionEvent[]> {
  const [rows] = await databasePool.query<DetectionEventRow[]>(
    `${selectEvent} ORDER BY de.timestamp DESC, de.event_id DESC`
  );
  return rows;
}

export async function findDetectionEventById(eventId: number): Promise<DetectionEvent | null> {
  const [rows] = await databasePool.execute<DetectionEventRow[]>(
    `${selectEvent} WHERE de.event_id = ?`,
    [eventId]
  );
  return rows[0] ?? null;
}

export async function createDetectionEvent(event: NewDetectionEvent): Promise<DetectionEvent> {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `INSERT INTO detection_events
       (camera_id, event_type, confidence, timestamp, snapshot)
     VALUES (?, ?, ?, ?, ?)`,
    [event.cameraId, event.eventType, event.confidence, event.timestamp, event.snapshot]
  );
  const created = await findDetectionEventById(result.insertId);
  if (!created) throw new Error('Created detection event could not be found.');
  return created;
}
