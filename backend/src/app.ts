import express from 'express';

import { errorHandler } from './middleware/error-handler.js';
import { binRouter } from './routes/bin.routes.js';
import { cameraRouter } from './routes/camera.routes.js';
import { collectionRouter } from './routes/collection.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { detectionEventRouter } from './routes/detection-event.routes.js';
import { sensorReadingRouter } from './routes/sensor-reading.routes.js';
import { smsIngestRouter } from './routes/sms-ingest.routes.js';

export const app = express();

app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/bins', binRouter);
app.use('/api/sensor-readings', sensorReadingRouter);
app.use('/api/sms', smsIngestRouter);
app.use('/api/cameras', cameraRouter);
app.use('/api/detection-events', detectionEventRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/collections', collectionRouter);
app.use(errorHandler);
