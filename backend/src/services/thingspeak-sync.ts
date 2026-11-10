import { findBinById, updateBinStatus } from '../repositories/bin.repository.js';
import { createSensorReading, hasSensorReadingAt } from '../repositories/sensor-reading.repository.js';
import { storedBinStatus } from './thresholds.js';
import { fetchThingSpeakFeeds } from './thingspeak.js';

export async function syncThingSpeakReadings(): Promise<number> {
  const channelId = process.env.THINGSPEAK_CHANNEL_ID?.trim();
  const readApiKey = process.env.THINGSPEAK_READ_API_KEY?.trim();
  const binId = process.env.THINGSPEAK_BIN_ID?.trim() || 'BIN_001';
  if (!channelId || !readApiKey) return 0;

  const bin = await findBinById(binId);
  if (!bin) {
    console.error(`ThingSpeak sync skipped: ${binId} is not in the database.`);
    return 0;
  }

  const readings = await fetchThingSpeakFeeds(channelId, readApiKey);
  let inserted = 0;
  for (const reading of readings) {
    if (await hasSensorReadingAt(binId, reading.timestamp)) continue;
    await createSensorReading({
      binId,
      fillLevelPercentage: reading.fillLevelPercentage,
      gasLevel: reading.gasLevel,
      tiltAngle: reading.tiltAngle,
      timestamp: reading.timestamp
    });
    inserted += 1;
  }

  const current = await findBinById(binId);
  if (current?.fillLevelPercentage != null && current.tiltAngle != null) {
    await updateBinStatus(binId, storedBinStatus(current.fillLevelPercentage, current.tiltAngle));
  }
  return inserted;
}

export function startThingSpeakSync(): void {
  const channelId = process.env.THINGSPEAK_CHANNEL_ID?.trim();
  const readApiKey = process.env.THINGSPEAK_READ_API_KEY?.trim();
  if (!channelId || !readApiKey) {
    console.warn('ThingSpeak sync is off until THINGSPEAK_CHANNEL_ID and THINGSPEAK_READ_API_KEY are set.');
    return;
  }

  const seconds = Number(process.env.THINGSPEAK_POLL_SECONDS ?? 20);
  if (!Number.isFinite(seconds) || seconds < 15) {
    throw new Error('THINGSPEAK_POLL_SECONDS must be a number of seconds, at least 15.');
  }

  const binId = process.env.THINGSPEAK_BIN_ID?.trim() || 'BIN_001';
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const inserted = await syncThingSpeakReadings();
      if (inserted > 0) console.log(`ThingSpeak: stored ${inserted} new reading(s) for ${binId}.`);
    } catch (error) {
      console.error('ThingSpeak sync failed.', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => { void tick(); }, seconds * 1000);
}
