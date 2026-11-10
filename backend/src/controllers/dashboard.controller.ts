import type { NextFunction, Request, Response } from 'express';

import { getDashboardSummary } from '../services/dashboard.service.js';

export async function showDashboardSummary(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(await getDashboardSummary());
  } catch (error) {
    next(error);
  }
}
