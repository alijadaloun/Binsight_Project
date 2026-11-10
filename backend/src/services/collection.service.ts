import { findAllDetectionEvents } from '../repositories/detection-event.repository.js';
import { findSensorReadings } from '../repositories/sensor-reading.repository.js';
import { getBins } from './bin.service.js';
import { analyzeCollections, type CollectionAnalysis } from './collection-analysis.js';

const overdueHours = Number(process.env.COLLECTION_OVERDUE_HOURS ?? 6);
if (!Number.isFinite(overdueHours) || overdueHours <= 0) {
  throw new Error('COLLECTION_OVERDUE_HOURS must be a positive number.');
}

const analysisWindowDays = 30;

export async function getCollections(): Promise<CollectionAnalysis> {
  const now = new Date();
  const from = new Date(now.getTime() - analysisWindowDays * 86_400_000);
  const [bins, readings, events] = await Promise.all([
    getBins(),
    findSensorReadings({ from }),
    findAllDetectionEvents()
  ]);
  return analyzeCollections(bins, readings, events.filter((event) => event.timestamp >= from), now, overdueHours);
}
