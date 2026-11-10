import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../middleware/http-error.js';
import type { NewDetectionEvent } from '../models/detection-event.js';
import { cameraExists } from '../repositories/camera.repository.js';
import { createDetectionEvent, findAllDetectionEvents, findDetectionEventById } from '../repositories/detection-event.repository.js';
import { optionalNumber, requireId, requireObject, requireTimestamp } from './ingestion-validation.js';

export async function listDetectionEvents(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(await findAllDetectionEvents());
  } catch (error) {
    next(error);
  }
}

export async function showDetectionEvent(request: Request<{ id: string }>, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!/^[1-9]\d*$/.test(request.params.id)) throw new HttpError(400, 'Event ID must be a positive integer.');
    const eventId = Number(request.params.id);
    if (!Number.isSafeInteger(eventId)) throw new HttpError(400, 'Event ID must be a positive integer.');
    const event = await findDetectionEventById(eventId);
    if (!event) throw new HttpError(404, 'Detection event not found.');
    response.json(event);
  } catch (error) {
    next(error);
  }
}

export async function postDetectionEvent(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const body = requireObject(request.body);
    if (typeof body.event_type !== 'string' || ![
      'GARBAGE_OUTSIDE_BIN', 'GARBAGE_TRUCK_PASS', 'GARBAGE_TRUCK_STOP'
    ].includes(body.event_type)) {
      throw new HttpError(400, 'event_type must be a supported detection event type.');
    }
    if (body.snapshot !== undefined && body.snapshot !== null &&
        (typeof body.snapshot !== 'string' || body.snapshot.length > 255 ||
         !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(body.snapshot) || body.snapshot === '..')) {
      throw new HttpError(400, 'snapshot must be a nonempty filename of at most 255 characters.');
    }
    const event: NewDetectionEvent = {
      cameraId: requireId(body.camera_id, 'camera_id'),
      eventType: body.event_type,
      confidence: optionalNumber(body.confidence, 'confidence', 0, 1),
      timestamp: requireTimestamp(body.timestamp),
      snapshot: body.snapshot as string | null | undefined ?? null
    };
    if (!await cameraExists(event.cameraId)) {
      throw new HttpError(404, 'Camera not found.');
    }
    const created = await createDetectionEvent(event);
    response.status(201).location(`/api/detection-events/${created.eventId}`).json(created);
  } catch (error) {
    next(error);
  }
}
