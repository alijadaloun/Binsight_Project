import { Router } from 'express';

import { listCollections } from '../controllers/collection.controller.js';

export const collectionRouter = Router();
collectionRouter.get('/', listCollections);
