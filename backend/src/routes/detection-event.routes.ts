import { Router } from 'express';

import { listDetectionEvents, postDetectionEvent, showDetectionEvent } from '../controllers/detection-event.controller.js';
import { requireIngestKey } from '../middleware/require-ingest-key.js';

export const detectionEventRouter = Router();
detectionEventRouter.get('/', listDetectionEvents);
detectionEventRouter.post('/', requireIngestKey, postDetectionEvent);
detectionEventRouter.get('/:id', showDetectionEvent);
