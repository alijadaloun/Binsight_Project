import { Router } from 'express';

import { listCameras } from '../controllers/camera.controller.js';

export const cameraRouter = Router();
cameraRouter.get('/', listCameras);
