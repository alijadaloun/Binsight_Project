import { fullFillPercentage } from './thresholds.js';

export const fullThreshold = fullFillPercentage;
export const emptiedThreshold = 20;

export type CollectionStatus = 'CONFIRMED' | 'INCOMPLETE' | 'PENDING' | 'MISSED' | 'OVERDUE';

export interface CollectionRecord {
  status: CollectionStatus;
  binId: string;
  clusterId: string;
  locationName: string | null;
  eventId: number | null;
  cameraId: string | null;
  fullSince: Date;
  truckAt: Date | null;
  fillBefore: number;
  fillAfter: number | null;
  responseMinutes: number | null;
}

export interface CollectionAnalysis {
  summary: Record<Lowercase<CollectionStatus>, number> & { averageResponseMinutes: number | null };
  records: CollectionRecord[];
}

interface AnalysisBin { binId: string; clusterId: string; locationName: string | null; readingStale: boolean }
interface AnalysisReading { binId: string; fillLevelPercentage: number | null; timestamp: Date }
interface AnalysisEvent { eventId: number; eventType: string; cameraId: string; clusterId: string; timestamp: Date }
type FillReading = AnalysisReading & { fillLevelPercentage: number };

// Start of the run of consecutive full readings that ends at index.
function fullSince(readings: FillReading[], index: number): Date {
  let start = index;
  while (start > 0 && readings[start - 1].fillLevelPercentage >= fullThreshold) start--;
  return readings[start].timestamp;
}

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

export function analyzeCollections(
  bins: AnalysisBin[],
  readings: AnalysisReading[],
  events: AnalysisEvent[],
  now: Date,
  overdueHours: number
): CollectionAnalysis {
  const readingsByBin = new Map<string, FillReading[]>();
  for (const reading of readings) {
    if (reading.fillLevelPercentage === null) continue;
    readingsByBin.set(reading.binId, [...(readingsByBin.get(reading.binId) ?? []), reading as FillReading]);
  }
  for (const list of readingsByBin.values()) list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const truckEvents = events
    .filter((event) => event.eventType === 'GARBAGE_TRUCK_STOP' || event.eventType === 'GARBAGE_TRUCK_PASS')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const records: CollectionRecord[] = [];
  const handled = new Set<string>();

  for (const event of truckEvents) {
    for (const bin of bins.filter((candidate) => candidate.clusterId === event.clusterId)) {
      const list = readingsByBin.get(bin.binId) ?? [];
      let beforeIndex = list.length - 1;
      while (beforeIndex >= 0 && list[beforeIndex].timestamp > event.timestamp) beforeIndex--;
      const before = list[beforeIndex];
      if (!before || before.fillLevelPercentage < fullThreshold) continue;

      // Several sightings of the same truck type before the bin reports again count once.
      const key = `${bin.binId}:${beforeIndex}:${event.eventType}`;
      if (handled.has(key)) continue;
      handled.add(key);

      const after = list[beforeIndex + 1] ?? null;
      const since = fullSince(list, beforeIndex);
      const stopped = event.eventType === 'GARBAGE_TRUCK_STOP';
      records.push({
        status: !stopped ? 'MISSED' : !after ? 'PENDING' : after.fillLevelPercentage <= emptiedThreshold ? 'CONFIRMED' : 'INCOMPLETE',
        binId: bin.binId,
        clusterId: bin.clusterId,
        locationName: bin.locationName,
        eventId: event.eventId,
        cameraId: event.cameraId,
        fullSince: since,
        truckAt: event.timestamp,
        fillBefore: before.fillLevelPercentage,
        fillAfter: after?.fillLevelPercentage ?? null,
        responseMinutes: stopped ? minutesBetween(since, event.timestamp) : null
      });
    }
  }

  for (const bin of bins) {
    const list = readingsByBin.get(bin.binId) ?? [];
    const latest = list.at(-1);
    if (bin.readingStale || !latest || latest.fillLevelPercentage < fullThreshold) continue;
    const since = fullSince(list, list.length - 1);
    const collected = truckEvents.some((event) => event.eventType === 'GARBAGE_TRUCK_STOP' &&
      event.clusterId === bin.clusterId && event.timestamp >= since);
    if (collected || now.getTime() - since.getTime() <= overdueHours * 3_600_000) continue;
    records.push({
      status: 'OVERDUE', binId: bin.binId, clusterId: bin.clusterId, locationName: bin.locationName,
      eventId: null, cameraId: null, fullSince: since, truckAt: null,
      fillBefore: latest.fillLevelPercentage, fillAfter: null, responseMinutes: minutesBetween(since, now)
    });
  }

  records.sort((a, b) => (b.truckAt ?? b.fullSince).getTime() - (a.truckAt ?? a.fullSince).getTime());
  const count = (status: CollectionStatus) => records.filter((record) => record.status === status).length;
  const confirmedTimes = records.filter((record) => record.status === 'CONFIRMED').map((record) => record.responseMinutes!);

  return {
    summary: {
      confirmed: count('CONFIRMED'),
      incomplete: count('INCOMPLETE'),
      pending: count('PENDING'),
      missed: count('MISSED'),
      overdue: count('OVERDUE'),
      averageResponseMinutes: confirmedTimes.length
        ? Math.round(confirmedTimes.reduce((sum, minutes) => sum + minutes, 0) / confirmedTimes.length)
        : null
    },
    records
  };
}
