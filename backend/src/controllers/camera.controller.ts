import type { NextFunction, Request, Response } from 'express';

import { findAllCameras } from '../repositories/camera.repository.js';

export async function listCameras(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(await findAllCameras());
  } catch (error) {
    next(error);
  }
}
