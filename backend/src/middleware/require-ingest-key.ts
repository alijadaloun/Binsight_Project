import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requireIngestKey(request: Request, response: Response, next: NextFunction): void {
  const configured = process.env.INGEST_API_KEY;
  if (!configured || configured.length < 32) {
    response.status(503).json({ error: 'Ingestion is disabled until INGEST_API_KEY is configured.' });
    return;
  }

  const authorization = request.get('authorization');
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(configured);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    response.status(401).json({ error: 'Invalid ingestion credentials.' });
    return;
  }
  next();
}
