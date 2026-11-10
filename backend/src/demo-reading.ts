import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { RowDataPacket } from 'mysql2';

// --fallen simulates a bin knocked over: the IMU reports it lying on its side.
const fallen = process.argv.includes('--fallen');

async function createDemoReading(): Promise<void> {
  const ingestKey = randomBytes(32).toString('hex');
  process.env.INGEST_API_KEY = ingestKey;
  const { databasePool } = await import('./config/database.js');
  let server: ReturnType<(typeof import('./app.js'))['app']['listen']> | undefined;

  try {
    const [bins] = await databasePool.query<(RowDataPacket & { binId: string })[]>(
      'SELECT bin_id AS binId FROM bins ORDER BY bin_id LIMIT 1'
    );
    if (!bins[0]) throw new Error('No bins found. Import the BinSight database first.');

    const { app } = await import('./app.js');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Unable to start the test API.');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/sensor-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ingestKey}` },
      body: JSON.stringify({
        bin_id: bins[0].binId,
        fill_level_percentage: fallen ? 35 : 96,
        gas_level: 7.25,
        tilt_angle: fallen ? 87.5 : 0,
        timestamp: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}: ${await response.text()}`);

    const reading = await response.json() as { id: number; binId: string; fillLevelPercentage: number; tiltAngle: number };
    console.log(`Created reading ${reading.id} for bin ${reading.binId} (fill ${reading.fillLevelPercentage}%, tilt ${reading.tiltAngle}°).`);
    if (fallen) console.log('The bin now shows as fallen. Run npm.cmd run demo:reading to set it upright again.');
    console.log('This reading remains in MySQL. Refresh the dashboard to see it.');
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    await databasePool.end();
  }
}

createDemoReading().catch((error: unknown) => {
  console.error('Demo reading failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
