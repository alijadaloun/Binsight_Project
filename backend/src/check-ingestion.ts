import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { RowDataPacket } from 'mysql2';

async function checkIngestion(): Promise<void> {
  const ingestKey = randomBytes(32).toString('hex');
  process.env.INGEST_API_KEY = ingestKey;
  const { databasePool } = await import('./config/database.js');
  const { app } = await import('./app.js');
  let server: ReturnType<typeof app.listen> | undefined;
  let readingId: number | undefined;
  let eventId: number | undefined;

  try {
    const [bins] = await databasePool.query<(RowDataPacket & { binId: string })[]>(
      'SELECT bin_id AS binId FROM bins ORDER BY bin_id LIMIT 1'
    );
    const [cameras] = await databasePool.query<(RowDataPacket & { cameraId: string })[]>(
      'SELECT camera_id AS cameraId FROM cameras ORDER BY camera_id LIMIT 1'
    );
    assert(bins[0] && cameras[0], 'The integration check needs an existing bin and camera.');

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function post(path: string, body: object): Promise<Response> {
      return fetch(`${baseUrl}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ingestKey}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
      });
    }

    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const unauthorized = await fetch(`${baseUrl}/api/sensor-readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bin_id: bins[0].binId, fill_level_percentage: 10,
        gas_level: 1, tilt_angle: 0, timestamp })
    });
    assert.equal(unauthorized.status, 401);
    const reading = await post('/api/sensor-readings', {
      bin_id: bins[0].binId, fill_level_percentage: 42.5, gas_level: 7.25,
      tilt_angle: 0, timestamp
    });
    assert.equal(reading.status, 201);
    const createdReading = await reading.json() as { id: number; binId: string; fillLevelPercentage: number };
    readingId = createdReading.id;
    assert.equal(createdReading.binId, bins[0].binId);
    assert.equal(createdReading.fillLevelPercentage, 42.5);
    const readings = await fetch(`${baseUrl}/api/sensor-readings?bin_id=${encodeURIComponent(bins[0].binId)}`);
    assert.equal(readings.status, 200);
    assert((await readings.json() as { id: number }[]).some((row) => row.id === readingId));
    console.log('POST /api/sensor-readings: passed');

    const event = await post('/api/detection-events', {
      camera_id: cameras[0].cameraId, event_type: 'GARBAGE_OUTSIDE_BIN',
      confidence: 0.91, timestamp: '2026-05-03 10:30:00', snapshot: `check_${Date.now()}.jpg`
    });
    assert.equal(event.status, 201);
    const createdEvent = await event.json() as { eventId: number; cameraId: string; confidence: number };
    eventId = createdEvent.eventId;
    assert.equal(createdEvent.cameraId, cameras[0].cameraId);
    assert.equal(createdEvent.confidence, 0.91);
    assert.equal(event.headers.get('location'), `/api/detection-events/${eventId}`);
    const fetched = await fetch(`${baseUrl}/api/detection-events/${eventId}`);
    assert.equal(fetched.status, 200);
    assert.deepEqual(await fetched.json(), createdEvent);
    console.log('POST /api/detection-events: passed');

    for (const [path, body, status] of [
      ['/api/sensor-readings', { bin_id: bins[0].binId, fill_level_percentage: 101, timestamp }, 400],
      ['/api/sensor-readings', { bin_id: bins[0].binId, gas_level: 1, timestamp }, 400],
      ['/api/sensor-readings', { bin_id: bins[0].binId, gas_level: 1, timestamp: '2026-02-30 10:30:00' }, 400],
      ['/api/sensor-readings', { bin_id: 'DOES_NOT_EXIST', fill_level_percentage: 10, gas_level: 1, tilt_angle: 0, timestamp }, 404],
      ['/api/detection-events', { camera_id: cameras[0].cameraId, event_type: 'INVALID', timestamp }, 400],
      ['/api/detection-events', { camera_id: cameras[0].cameraId, event_type: 'GARBAGE_OUTSIDE_BIN', timestamp, snapshot: '../private.jpg' }, 400],
      ['/api/detection-events', { camera_id: 'DOES_NOT_EXIST', event_type: 'GARBAGE_OUTSIDE_BIN', timestamp }, 404]
    ] as const) {
      const response = await post(path, body);
      assert.equal(response.status, status, `${path} returned HTTP ${response.status}`);
    }
    console.log('Invalid values and unknown IDs: passed');
  } finally {
    if (eventId !== undefined) await databasePool.execute('DELETE FROM detection_events WHERE event_id = ?', [eventId]);
    if (readingId !== undefined) await databasePool.execute('DELETE FROM sensor_readings WHERE id = ?', [readingId]);
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    await databasePool.end();
  }
}

checkIngestion().catch((error: unknown) => {
  console.error('Ingestion verification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
