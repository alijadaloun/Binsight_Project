import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { RowDataPacket } from 'mysql2';
import type { Bin } from './models/bin.js';
import type { Camera } from './models/camera.js';
import type { DetectionEvent } from './models/detection-event.js';
import type { SensorReading } from './models/sensor-reading.js';
import { isReadingStale } from './services/bin.service.js';

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function expectStatus(baseUrl: string, path: string, status: number): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, `${path} should return HTTP ${status}`);
}

async function checkBackend(): Promise<void> {
  const { databasePool, verifyDatabaseConnection } = await import('./config/database.js');
  let server: ReturnType<(typeof import('./app.js'))['app']['listen']> | undefined;

  try {
    await verifyDatabaseConnection();

    for (const table of ['bin_clusters', 'bins', 'sensor_readings', 'cameras', 'detection_events']) {
      const [rows] = await databasePool.query<(RowDataPacket & { count: number })[]>(
        `SELECT COUNT(*) AS count FROM ${table}`
      );
      console.log(`${table}: ${rows[0].count} rows`);
    }

    const { app } = await import('./app.js');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    assert.deepEqual(await getJson(baseUrl, '/api/health'), { status: 'ok' });
    console.log('GET /api/health: passed');

    const bins = await getJson<Bin[]>(baseUrl, '/api/bins');
    assert(Array.isArray(bins));
    const [counts] = await databasePool.query<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM bins'
    );
    assert.equal(bins.length, counts[0].count);

    for (const bin of bins) {
      const [readings] = await databasePool.execute<RowDataPacket[]>(
        `SELECT fill_level_percentage AS fillLevelPercentage,
                gas_level AS gasLevel, tilt_angle AS tiltAngle, timestamp
         FROM sensor_readings WHERE bin_id = ?
         ORDER BY timestamp DESC, id DESC LIMIT 1`,
        [bin.binId]
      );
      const latest = readings[0];
      assert.equal(bin.fillLevelPercentage, latest?.fillLevelPercentage ?? null);
      assert.equal(bin.gasLevel, latest?.gasLevel ?? null);
      assert.equal(bin.tiltAngle, latest?.tiltAngle ?? null);
      assert.equal(bin.lastUpdated, latest ? latest.timestamp.toISOString() : null);
      assert.equal(bin.readingStale, isReadingStale(latest?.timestamp ?? null));
      const fill = bin.fillLevelPercentage;
      const expectedStatus = fill === null ? null : fill >= 95 ? 'CRITICAL'
        : fill >= 85 ? 'NEEDS_COLLECTION' : fill >= 70 ? 'WARNING' : 'NORMAL';
      assert.equal(bin.computedStatus, expectedStatus);
    }

    console.log(`GET /api/bins: passed (${bins.length} bins; latest readings and statuses verified)`);
    if (bins.length === 0) console.log('The database is reachable but contains no bins.');

    if (bins.length) {
      const bin = bins[0];
      assert.deepEqual(await getJson(baseUrl, `/api/bins/${bin.binId}`), bin);
      const history = await getJson<SensorReading[]>(baseUrl, `/api/bins/${bin.binId}/readings`);
      const [historyCount] = await databasePool.execute<(RowDataPacket & { count: number })[]>(
        'SELECT COUNT(*) AS count FROM sensor_readings WHERE bin_id = ?', [bin.binId]
      );
      assert.equal(history.length, historyCount[0].count);
      assert(history.every((reading) => reading.binId === bin.binId));
      for (let index = 1; index < history.length; index++) {
        assert(history[index - 1].timestamp <= history[index].timestamp);
      }
      await expectStatus(baseUrl, '/api/bins/DOES_NOT_EXIST', 404);
      await expectStatus(baseUrl, '/api/bins/DOES_NOT_EXIST/readings', 404);
      console.log('GET /api/bins/:id and /api/bins/:id/readings: passed');
    }

    const allReadings = await getJson<SensorReading[]>(baseUrl, '/api/sensor-readings');
    const [readingCount] = await databasePool.query<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM sensor_readings'
    );
    assert.equal(allReadings.length, readingCount[0].count);
    if (bins.length) {
      const selected = await getJson<SensorReading[]>(baseUrl, `/api/sensor-readings?bin_id=${bins[0].binId}`);
      assert(selected.every((reading) => reading.binId === bins[0].binId));
      assert.equal(selected.length, allReadings.filter((reading) => reading.binId === bins[0].binId).length);
    }
    await expectStatus(baseUrl, '/api/sensor-readings?from=invalid', 400);
    console.log('GET /api/sensor-readings: passed (count and filters verified)');

    const cameras = await getJson<Camera[]>(baseUrl, '/api/cameras');
    const [cameraCount] = await databasePool.query<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM cameras'
    );
    assert.equal(cameras.length, cameraCount[0].count);
    assert(cameras.every((camera) => camera.clusterId && camera.locationName));
    console.log('GET /api/cameras: passed');

    const events = await getJson<DetectionEvent[]>(baseUrl, '/api/detection-events');
    const [eventCount] = await databasePool.query<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM detection_events'
    );
    assert.equal(events.length, eventCount[0].count);
    for (let index = 1; index < events.length; index++) {
      assert(events[index - 1].timestamp >= events[index].timestamp);
    }
    if (events.length) {
      assert.deepEqual(await getJson(baseUrl, `/api/detection-events/${events[0].eventId}`), events[0]);
    }
    await expectStatus(baseUrl, '/api/detection-events/invalid', 400);
    await expectStatus(baseUrl, '/api/detection-events/999999999', 404);
    console.log('GET /api/detection-events and /api/detection-events/:id: passed');

    const summary = await getJson<{
      totalBins: number; normalBins: number; warningBins: number;
      needsCollectionBins: number; criticalBins: number;
      staleBins: number;
      totalAiEvents: number; activeAiEvents: null;
      totalCameras: number; onlineCameras: null; lastUpdated: string | null;
    }>(baseUrl, '/api/dashboard/summary');
    assert.equal(summary.totalBins, bins.length);
    assert.equal(summary.normalBins, bins.filter((bin) => bin.computedStatus === 'NORMAL').length);
    assert.equal(summary.warningBins, bins.filter((bin) => bin.computedStatus === 'WARNING').length);
    assert.equal(summary.needsCollectionBins, bins.filter((bin) => bin.computedStatus === 'NEEDS_COLLECTION').length);
    assert.equal(summary.criticalBins, bins.filter((bin) => bin.computedStatus === 'CRITICAL').length);
    assert.equal(summary.staleBins, bins.filter((bin) => bin.readingStale).length);
    assert.equal(summary.totalAiEvents, events.length);
    assert.equal(summary.totalCameras, cameras.length);
    assert.equal(summary.activeAiEvents, null);
    assert.equal(summary.onlineCameras, null);
    console.log('GET /api/dashboard/summary: passed');
  } finally {
    if (server) {
      const runningServer = server;
      runningServer.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        runningServer.close((error) => error ? reject(error) : resolve());
      });
    }
    await databasePool.end();
  }
}

checkBackend().catch((error: unknown) => {
  console.error('Backend verification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
