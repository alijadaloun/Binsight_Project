import { Router } from 'express';

import { listBinReadings, listBins, showBin } from '../controllers/bin.controller.js';

export const binRouter = Router();

binRouter.get('/', listBins);
binRouter.get('/:id/readings', listBinReadings);
binRouter.get('/:id', showBin);
