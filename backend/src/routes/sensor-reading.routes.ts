import { Router } from 'express';

import { listSensorReadings, postSensorReading } from '../controllers/sensor-reading.controller.js';
import { requireIngestKey } from '../middleware/require-ingest-key.js';

export const sensorReadingRouter = Router();
sensorReadingRouter.get('/', listSensorReadings);
sensorReadingRouter.post('/', requireIngestKey, postSensorReading);
