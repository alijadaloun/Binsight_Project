import { Router } from 'express';

import { postSms } from '../controllers/sms-ingest.controller.js';
import { requireIngestKey } from '../middleware/require-ingest-key.js';

export const smsIngestRouter = Router();
smsIngestRouter.post('/ingest', requireIngestKey, postSms);
