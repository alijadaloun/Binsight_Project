import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { RowDataPacket } from 'mysql2';

interface Site { clusterId: string; cameraId: string; binId: string }
interface Step { hoursAgo: number; fill?: number; truck?: 'GARBAGE_TRUCK_STOP' | 'GARBAGE_TRUCK_PASS' }

// One scenario per location, so the Collections page shows each outcome.
const scenarios: { name: string; steps: Step[] }[] = [
  { name: 'confirmed', steps: [{ hoursAgo: 8, fill: 40 }, { hoursAgo: 6, fill: 65 }, { hoursAgo: 4, fill: 85 },
    { hoursAgo: 3, truck: 'GARBAGE_TRUCK_STOP' }, { hoursAgo: 2.5, fill: 5 }] },
  { name: 'missed', steps: [{ hoursAgo: 5, fill: 70 }, { hoursAgo: 4, truck: 'GARBAGE_TRUCK_PASS' }, { hoursAgo: 1, fill: 90 }] },
  { name: 'incomplete', steps: [{ hoursAgo: 3, fill: 88 }, { hoursAgo: 2, truck: 'GARBAGE_TRUCK_STOP' }, { hoursAgo: 1.5, fill: 80 }] },
  { name: 'overdue', steps: [{ hoursAgo: 10, fill: 62 }, { hoursAgo: 1, fill: 92 }] }
];

async function createDemoCollections(): Promise<void> {
  const ingestKey = randomBytes(32).toString('hex');
  process.env.INGEST_API_KEY = ingestKey;
  const { databasePool } = await import('./config/database.js');
  let server: ReturnType<(typeof import('./app.js'))['app']['listen']> | undefined;

  try {
    const [rows] = await databasePool.query<(RowDataPacket & Site)[]>(`
      SELECT c.cluster_id AS clusterId, MIN(c.camera_id) AS cameraId, MIN(b.bin_id) AS binId
      FROM cameras c JOIN bins b ON b.cluster_id = c.cluster_id
      GROUP BY c.cluster_id ORDER BY c.cluster_id
    `);
    if (!rows.length) throw new Error('No location has both a camera and a bin. Import the BinSight database first.');

    const { app } = await import('./app.js');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Unable to start the test API.');

    const post = async (path: string, body: object) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ingestKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`API returned HTTP ${response.status}: ${await response.text()}`);
    };

    const now = Date.now();
    for (const [index, scenario] of scenarios.entries()) {
      const site = rows[index % rows.length];
      for (const step of scenario.steps) {
        const timestamp = new Date(now - step.hoursAgo * 3_600_000).toISOString();
        if (step.fill !== undefined) {
          await post('/api/sensor-readings', { bin_id: site.binId, fill_level_percentage: step.fill, gas_level: 3, tilt_angle: 0, timestamp });
        } else {
          await post('/api/detection-events', { camera_id: site.cameraId, event_type: step.truck, confidence: 0.92, timestamp });
        }
      }
      console.log(`Created ${scenario.name} scenario for ${site.binId} (camera ${site.cameraId}).`);
    }
    if (rows.length < scenarios.length) {
      console.log(`Only ${rows.length} location(s) have a camera, so some scenarios share a bin and may affect each other.`);
    }
    console.log('These rows remain in MySQL. Refresh the Collections page to see them.');
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    await databasePool.end();
  }
}

createDemoCollections().catch((error: unknown) => {
  console.error('Demo collections failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
