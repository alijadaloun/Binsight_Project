import type { NextFunction, Request, Response } from 'express';

import { getCollections } from '../services/collection.service.js';

export async function listCollections(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(await getCollections());
  } catch (error) {
    next(error);
  }
}
