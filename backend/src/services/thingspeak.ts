export interface ThingSpeakReading {
  entryId: number;
  timestamp: Date;
  fillLevelPercentage: number;
  gasLevel: number;
  tiltAngle: number;
}

function parseMeasurement(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 100) / 100;
}

function parseFeed(feed: unknown): ThingSpeakReading | null {
  if (!feed || typeof feed !== 'object') return null;
  const record = feed as Record<string, unknown>;
  const entryId = typeof record.entry_id === 'number' ? record.entry_id : Number(record.entry_id);
  const timestamp = typeof record.created_at === 'string' ? new Date(record.created_at) : new Date(Number.NaN);
  const fillLevelPercentage = parseMeasurement(record.field1, 0, 100);
  const gasLevel = parseMeasurement(record.field2, 0, 9999.99);
  const tiltAngle = parseMeasurement(record.field3, -999.99, 999.99);
  if (!Number.isInteger(entryId) || Number.isNaN(timestamp.getTime())) return null;
  if (fillLevelPercentage === null || gasLevel === null || tiltAngle === null) return null;
  return { entryId, timestamp, fillLevelPercentage, gasLevel, tiltAngle };
}

// ThingSpeak sends field1/2/3 as strings. Feeds with a missing or out-of-range field are skipped
// so an empty channel update does not erase the last complete sensor sample.
export function parseThingSpeakFeeds(payload: unknown): ThingSpeakReading[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { feeds?: unknown }).feeds)) {
    throw new Error('ThingSpeak response did not include a feeds list.');
  }

  const readings = (payload as { feeds: unknown[] }).feeds.flatMap((feed) => {
    const reading = parseFeed(feed);
    return reading ? [reading] : [];
  });
  readings.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime() || left.entryId - right.entryId);
  return readings;
}

export async function fetchThingSpeakFeeds(channelId: string, readApiKey: string): Promise<ThingSpeakReading[]> {
  const url = new URL(`https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json`);
  url.searchParams.set('api_key', readApiKey);
  url.searchParams.set('results', '100');

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`ThingSpeak returned HTTP ${response.status}.`);
  return parseThingSpeakFeeds(await response.json());
}
