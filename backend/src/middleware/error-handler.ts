import { NextFunction, Request, Response } from 'express';
import { HttpError } from './http-error.js';

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Unable to retrieve monitoring data.' });
}
