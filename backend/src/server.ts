import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

async function startServer(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const { app } = await import('./app.js');
  const { verifyDatabaseConnection } = await import('./config/database.js');
  await verifyDatabaseConnection();
  const { startThingSpeakSync } = await import('./services/thingspeak-sync.js');
  startThingSpeakSync();

  app.listen(port, host, () => {
    console.log(`BinSight API listening on ${host}:${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Unable to start BinSight API.', error);
  process.exit(1);
});
