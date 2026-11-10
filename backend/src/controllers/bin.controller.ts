import { Request, Response, NextFunction } from 'express';

import { HttpError } from '../middleware/http-error.js';
import { findBinReadings } from '../repositories/sensor-reading.repository.js';
import { getBin, getBins } from '../services/bin.service.js';

export async function listBins(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(await getBins());
  } catch (error) {
    next(error);
  }
}

export async function showBin(request: Request<{ id: string }>, response: Response, next: NextFunction): Promise<void> {
  try {
    const bin = await getBin(request.params.id);
    if (!bin) throw new HttpError(404, 'Bin not found.');
    response.json(bin);
  } catch (error) {
    next(error);
  }
}

export async function listBinReadings(request: Request<{ id: string }>, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!await getBin(request.params.id)) throw new HttpError(404, 'Bin not found.');
    response.json(await findBinReadings(request.params.id));
  } catch (error) {
    next(error);
  }
}
